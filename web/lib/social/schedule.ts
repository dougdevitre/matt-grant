import { PutCommand, QueryCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";
import { publishToChannel, type PublishablePost } from "@/lib/social/publish";
import { CHANNELS, type ChannelId } from "@/lib/social/channels";

// Scheduled social posts — the calendar behind the Command Center. One partition
// (SOCIALPOST), sort key `${scheduledAt}#${id}` so a query returns them in time
// order. Due posts are published by drainDue() (the /api/cron/social-drain worker,
// same cadence as the email drain). A claim-before-publish status flip makes the
// worker idempotent so two overlapping runs never double-post a channel.

const SOCIAL_PK = "SOCIALPOST";

export type PostStatus =
  | "draft" // saved, not on the calendar
  | "scheduled" // on the calendar, waiting for its time
  | "posting" // claimed by the drain, publishing now
  | "posted" // every channel done (API + manual confirmed)
  | "awaiting" // published what it could; manual channels need a human
  | "partial" // some channels failed
  | "failed" // all channels failed
  | "canceled";

export type ChannelState = {
  status: "pending" | "posted" | "ready" | "failed"; // ready = manual, awaiting human
  mode: "api" | "manual";
  externalId?: string;
  postedAt?: string;
  error?: string;
};

export type ScheduledPost = {
  id: string;
  createdAt: string;
  createdBy: string;
  caption: string;
  hashtags: string[];
  channels: ChannelId[];
  link?: string;
  mediaKey?: string;
  mediaUrl?: string;
  videoUrl?: string;
  pillar?: string;
  cta?: string;
  scheduledAt?: string; // absent = draft
  status: PostStatus;
  perChannel: Partial<Record<ChannelId, ChannelState>>;
  updatedAt?: string;
  postedAt?: string;
};

type Item = ScheduledPost & { PK: string; SK: string };

export async function createPost(input: {
  caption: string;
  hashtags: string[];
  channels: ChannelId[];
  link?: string;
  mediaKey?: string;
  mediaUrl?: string;
  videoUrl?: string;
  pillar?: string;
  cta?: string;
  scheduledAt?: string; // ISO; absent or empty → draft
  createdBy: string;
}): Promise<string> {
  const id = newId();
  const createdAt = new Date().toISOString();
  const scheduled = !!input.scheduledAt;
  // SK sorts the calendar: scheduled posts by their time, drafts by creation.
  const sortTs = input.scheduledAt || createdAt;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: SOCIAL_PK,
        SK: `${sortTs}#${id}`,
        id,
        createdAt,
        createdBy: input.createdBy,
        caption: input.caption,
        hashtags: input.hashtags,
        channels: input.channels,
        ...(input.link ? { link: input.link } : {}),
        ...(input.mediaKey ? { mediaKey: input.mediaKey } : {}),
        ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
        ...(input.videoUrl ? { videoUrl: input.videoUrl } : {}),
        ...(input.pillar ? { pillar: input.pillar } : {}),
        ...(input.cta ? { cta: input.cta } : {}),
        ...(scheduled ? { scheduledAt: input.scheduledAt } : {}),
        status: scheduled ? "scheduled" : "draft",
        perChannel: {},
      },
    }),
  );
  return id;
}

async function allPosts(): Promise<Item[]> {
  const r = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": SOCIAL_PK },
      ScanIndexForward: true, // chronological — the calendar reads top-to-bottom
    }),
  );
  return (r.Items ?? []) as Item[];
}

export async function listPosts(): Promise<ScheduledPost[]> {
  if (!dbConfigured) return [];
  try {
    return (await allPosts()).map(strip);
  } catch {
    return [];
  }
}

function strip(i: Item): ScheduledPost {
  const { PK: _pk, SK: _sk, ...rest } = i;
  return { ...rest, hashtags: rest.hashtags ?? [], channels: rest.channels ?? [], perChannel: rest.perChannel ?? {} };
}

async function findSK(id: string): Promise<string | null> {
  const posts = await allPosts();
  return posts.find((p) => p.id === id)?.SK ?? null;
}

export async function cancelPost(id: string): Promise<boolean> {
  if (!dbConfigured) return false;
  const SK = await findSK(id);
  if (!SK) return false;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SOCIAL_PK, SK },
      UpdateExpression: "SET #s = :c, updatedAt = :u",
      ConditionExpression: "#s IN (:scheduled, :draft, :awaiting)",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":c": "canceled", ":u": new Date().toISOString(), ":scheduled": "scheduled", ":draft": "draft", ":awaiting": "awaiting" },
    }),
  ).catch(() => {});
  return true;
}

/** Mark a manual ("ready") channel as posted after a human pushed it. */
export async function confirmChannelPosted(id: string, channel: ChannelId): Promise<boolean> {
  if (!dbConfigured) return false;
  const SK = await findSK(id);
  if (!SK) return false;
  const now = new Date().toISOString();
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SOCIAL_PK, SK } }));
  const post = r.Item ? strip(r.Item as Item) : null;
  if (!post) return false;
  const perChannel = { ...post.perChannel, [channel]: { ...(post.perChannel[channel] ?? { mode: "manual" as const }), status: "posted" as const, mode: "manual" as const, postedAt: now } };
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SOCIAL_PK, SK },
      UpdateExpression: "SET perChannel = :pc, #s = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":pc": perChannel, ":s": rollUp(post.channels, perChannel), ":u": now },
    }),
  );
  return true;
}

/** Derive the overall post status from its per-channel states. Exported for tests. */
export function rollUp(channels: ChannelId[], perChannel: Partial<Record<ChannelId, ChannelState>>): PostStatus {
  const states = channels.map((c) => perChannel[c]?.status ?? "pending");
  if (states.every((s) => s === "posted")) return "posted";
  if (states.some((s) => s === "ready")) return "awaiting";
  if (states.every((s) => s === "failed")) return "failed";
  if (states.some((s) => s === "failed")) return "partial";
  return "posting";
}

/**
 * Publish every post whose time has arrived. Claims each post (scheduled→posting)
 * before publishing so overlapping cron runs can't double-post. Returns a summary.
 */
export async function drainDue(limit = 10): Promise<{ processed: number; posts: { id: string; status: PostStatus }[] }> {
  if (!dbConfigured) return { processed: 0, posts: [] };
  const nowIso = new Date().toISOString();
  const due = (await allPosts()).filter((p) => p.status === "scheduled" && (p.scheduledAt ?? "") <= nowIso).slice(0, limit);
  const out: { id: string; status: PostStatus }[] = [];

  for (const post of due) {
    // CLAIM: scheduled → posting, only if still scheduled (no other drainer took it).
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: SOCIAL_PK, SK: post.SK },
          UpdateExpression: "SET #s = :posting, updatedAt = :u",
          ConditionExpression: "#s = :scheduled",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":posting": "posting", ":scheduled": "scheduled", ":u": nowIso },
        }),
      );
    } catch (e) {
      if ((e as { name?: string })?.name === "ConditionalCheckFailedException") continue; // another run owns it
      throw e;
    }

    const payload: PublishablePost = { caption: post.caption, hashtags: post.hashtags ?? [], link: post.link, mediaUrl: post.mediaUrl, videoUrl: post.videoUrl };
    const perChannel: Partial<Record<ChannelId, ChannelState>> = { ...post.perChannel };
    for (const channel of post.channels ?? []) {
      if (!CHANNELS[channel]) continue;
      const res = await publishToChannel(channel, payload);
      if (res.ok && res.mode === "api") perChannel[channel] = { status: "posted", mode: "api", externalId: res.externalId, postedAt: new Date().toISOString() };
      else if (res.ok && res.mode === "manual") perChannel[channel] = { status: "ready", mode: "manual" };
      else perChannel[channel] = { status: "failed", mode: res.mode, error: res.ok ? undefined : res.error };
    }
    const status = rollUp(post.channels ?? [], perChannel);
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: SOCIAL_PK, SK: post.SK },
        UpdateExpression: "SET perChannel = :pc, #s = :s, updatedAt = :u" + (status === "posted" ? ", postedAt = :u" : ""),
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":pc": perChannel, ":s": status, ":u": new Date().toISOString() },
      }),
    );
    out.push({ id: post.id, status });
  }
  return { processed: out.length, posts: out };
}
