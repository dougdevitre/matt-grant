import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";
import { isSuppressed, type TopicKey } from "@/lib/subscribers";
import { getBroadcast } from "@/lib/email/broadcasts";
import { sendBroadcastEmail } from "@/lib/campaignSend";

// Template-driven, topic-aware broadcast campaigns. Queued, then sent in bounded
// batches by drainOnce() (first batch inline + /api/cron/email-drain worker) so a
// large list never blocks one request past the function timeout. Recipients who
// are globally suppressed OR opted out of the campaign's topic are skipped.
const CAMPAIGN_PK = "CAMPAIGN";
const STATS_PK = "CAMPAIGN_STATS"; // per-campaign open/click counters, keyed by campaign id
const BATCH = 25;

export type CampaignStatus = "scheduled" | "queued" | "sending" | "sent" | "failed";
type CampaignItem = {
  SK: string;
  id: string;
  createdAt: string;
  scheduledAt?: string;
  templateKey: string;
  topic: TopicKey;
  vars: Record<string, string>;
  audience: string;
  subjectPreview: string;
  status: CampaignStatus;
  recipients: string[];
  cursor: number;
  sentCount: number;
  suppressedCount: number;
  createdBy: string;
  updatedAt?: string;
  finishedAt?: string;
};
export type CampaignSummary = {
  id: string;
  createdAt: string;
  subjectPreview: string;
  templateKey: string;
  topic: TopicKey;
  audience: string;
  status: CampaignStatus;
  scheduledAt?: string;
  total: number;
  sentCount: number;
  suppressedCount: number;
  delivered: number;
  opens: number;
  clicks: number;
  createdBy: string;
};

export async function createCampaign(input: {
  templateKey: string;
  topic: TopicKey;
  vars: Record<string, string>;
  audience: string;
  recipients: string[];
  subjectPreview: string;
  createdBy: string;
  scheduledAt?: string;
}): Promise<string> {
  const id = newId();
  const createdAt = new Date().toISOString();
  const scheduled = !!input.scheduledAt && input.scheduledAt > createdAt;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: CAMPAIGN_PK,
        SK: `${createdAt}#${id}`,
        id,
        createdAt,
        ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
        templateKey: input.templateKey,
        topic: input.topic,
        vars: input.vars,
        audience: input.audience,
        subjectPreview: input.subjectPreview,
        status: scheduled ? "scheduled" : "queued",
        recipients: input.recipients,
        cursor: 0,
        sentCount: 0,
        suppressedCount: 0,
        createdBy: input.createdBy,
      },
    }),
  );
  return id;
}

async function allCampaigns(): Promise<CampaignItem[]> {
  const r = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": CAMPAIGN_PK },
      ScanIndexForward: false,
    }),
  );
  return (r.Items ?? []) as CampaignItem[];
}

async function getStats(): Promise<Record<string, { delivered: number; opens: number; clicks: number }>> {
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": STATS_PK } }),
    );
    const out: Record<string, { delivered: number; opens: number; clicks: number }> = {};
    for (const i of r.Items ?? [])
      out[String(i.SK)] = { delivered: Number(i.delivered ?? 0), opens: Number(i.opens ?? 0), clicks: Number(i.clicks ?? 0) };
    return out;
  } catch {
    return {};
  }
}

export async function listCampaigns(limit = 15): Promise<CampaignSummary[]> {
  if (!dbConfigured) return [];
  try {
    const items = (await allCampaigns()).slice(0, limit);
    const stats = await getStats();
    return items.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      subjectPreview: c.subjectPreview ?? "(campaign)",
      templateKey: c.templateKey,
      topic: c.topic,
      audience: c.audience,
      status: c.status,
      scheduledAt: c.scheduledAt,
      total: c.recipients?.length ?? 0,
      sentCount: c.sentCount ?? 0,
      suppressedCount: c.suppressedCount ?? 0,
      delivered: stats[c.id]?.delivered ?? 0,
      opens: stats[c.id]?.opens ?? 0,
      clicks: stats[c.id]?.clicks ?? 0,
      createdBy: c.createdBy,
    }));
  } catch {
    return [];
  }
}

// Increment a campaign's delivered/open/click counter (from the SES event webhook).
export async function recordEngagement(campaignId: string, kind: "delivered" | "open" | "click"): Promise<void> {
  if (!dbConfigured || !campaignId) return;
  const attr = kind === "delivered" ? "delivered" : kind === "open" ? "opens" : "clicks";
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: STATS_PK, SK: campaignId },
        UpdateExpression: `ADD ${attr} :one`,
        ExpressionAttributeValues: { ":one": 1 },
      }),
    );
  } catch {
    /* analytics is best-effort */
  }
}

// Send the next bounded batch of the oldest active campaign. Renders the template
// once, then sends to recipients not suppressed for this campaign's topic.
export async function drainOnce(
  base: string,
  batchSize = BATCH,
): Promise<{ id: string; sent: number; done: boolean; cursor: number; total: number } | null> {
  if (!dbConfigured) return null;
  const nowIso = new Date().toISOString();
  const active = (await allCampaigns())
    .filter(
      (c) =>
        c.status === "queued" ||
        c.status === "sending" ||
        (c.status === "scheduled" && (c.scheduledAt ?? "") <= nowIso),
    )
    .sort((a, b) => (a.scheduledAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.createdAt))[0];
  if (!active) return null;

  const now = new Date().toISOString();
  const broadcast = getBroadcast(active.templateKey);
  if (!broadcast) {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: CAMPAIGN_PK, SK: active.SK },
        UpdateExpression: "SET #s = :s, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "failed", ":u": now },
      }),
    );
    return { id: active.id, sent: active.sentCount ?? 0, done: true, cursor: active.cursor ?? 0, total: active.recipients?.length ?? 0 };
  }

  const recipients = active.recipients ?? [];
  const start = active.cursor ?? 0;

  // Already fully drained → finalize idempotently.
  if (start >= recipients.length) {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: CAMPAIGN_PK, SK: active.SK },
        UpdateExpression: "SET #s = :sent, finishedAt = :u, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":sent": "sent", ":u": now },
      }),
    );
    return { id: active.id, sent: active.sentCount ?? 0, done: true, cursor: start, total: recipients.length };
  }

  const end = Math.min(start + batchSize, recipients.length);

  // CLAIM [start,end) atomically: advance the cursor only if no other drainer
  // moved it. Without this, the inline send + the every-minute cron worker could
  // both read the same cursor and send the same recipients twice.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: CAMPAIGN_PK, SK: active.SK },
        UpdateExpression: "SET #cur = :end, #s = :sending, updatedAt = :u",
        ConditionExpression: "#cur = :start AND #s IN (:queued, :sendingC, :scheduled)",
        ExpressionAttributeNames: { "#cur": "cursor", "#s": "status" },
        ExpressionAttributeValues: {
          ":end": end,
          ":start": start,
          ":sending": "sending",
          ":sendingC": "sending",
          ":queued": "queued",
          ":scheduled": "scheduled",
          ":u": now,
        },
      }),
    );
  } catch (e) {
    if ((e as { name?: string })?.name === "ConditionalCheckFailedException") return null; // another drainer has it
    throw e;
  }

  // We exclusively own [start,end). Send it (claim-before-send = at-most-once,
  // never duplicates).
  const email = broadcast.build(active.vars ?? {});
  const slice = recipients.slice(start, end);
  let sentDelta = 0;
  let suppressedDelta = 0;
  for (const addr of slice) {
    if (await isSuppressed(addr, active.topic)) {
      suppressedDelta++;
      continue;
    }
    const r = await sendBroadcastEmail({ to: addr, email, base, campaignId: active.id });
    if (r.sent) sentDelta++;
  }

  const done = end >= recipients.length;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CAMPAIGN_PK, SK: active.SK },
      UpdateExpression: "ADD sentCount :sd, suppressedCount :pd" + (done ? " SET #s = :sent, finishedAt = :u, updatedAt = :u" : " SET updatedAt = :u"),
      ...(done ? { ExpressionAttributeNames: { "#s": "status" } } : {}),
      ExpressionAttributeValues: { ":sd": sentDelta, ":pd": suppressedDelta, ":u": now, ...(done ? { ":sent": "sent" } : {}) },
    }),
  );
  return { id: active.id, sent: (active.sentCount ?? 0) + sentDelta, done, cursor: end, total: recipients.length };
}
