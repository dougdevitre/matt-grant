import { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { flagProfanity } from "@/lib/sms/moderation";

// 1:1 Meta inbox — Facebook Messenger + Instagram DMs in one store (both arrive
// through the same Messenger Platform webhook). Two item types, mirroring the SMS
// inbox (lib/sms/conversations.ts):
//   • Conversation index: PK="MSGRCONVO", SK="<platform>:<psid>" — one row per person.
//   • Thread message:     PK="MSGRTHREAD#<platform>:<psid>", SK="<iso>#<id>".
// Keyed by the page-scoped sender id (PSID for Messenger, IGSID for Instagram).
// No consent/opt-out machinery (that's TCPA/SMS-only) — replies are gated instead
// on Meta's 24-hour standard-messaging window (canReplyNow) + a block list.

const CONVO_PK = PK.msgrConvos;
const BLOCK_PK = PK.msgrBlocks;
const SNIPPET = 280;

// Meta's standard-messaging window: a Page may reply to a user for 24h after the
// user's last message. Outside it, proactive sends need message tags (not used
// here — this inbox is human replies to people who messaged us).
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type MetaPlatform = "messenger" | "instagram";
export type MsgDirection = "in" | "out";

export function isMetaPlatform(v: string): v is MetaPlatform {
  return v === "messenger" || v === "instagram";
}

/** Stable conversation key: platform + page-scoped id. */
export function convoKey(platform: MetaPlatform, psid: string): string {
  return `${platform}:${psid}`;
}
/** Parse a stored key back into its parts (psid may itself be numeric). */
export function parseKey(key: string): { platform: MetaPlatform; psid: string } | null {
  const i = key.indexOf(":");
  if (i < 0) return null;
  const platform = key.slice(0, i);
  const psid = key.slice(i + 1);
  return isMetaPlatform(platform) && psid ? { platform, psid } : null;
}

export type MsgrMessage = {
  id: string;
  direction: MsgDirection;
  body: string;
  mid?: string; // Meta message id
  status?: string; // "received" | "sent" | "failed"
  by?: string; // staff email (outbound)
  flagged?: boolean;
  flaggedTerms?: string[];
  createdAt: string;
};

export type MsgrConversation = {
  key: string; // `${platform}:${psid}`
  platform: MetaPlatform;
  psid: string;
  name?: string; // display name, when Graph profile enrichment provided one
  lastBody: string;
  lastDirection: MsgDirection;
  lastAt: string;
  lastInboundAt?: string; // drives the 24h reply window
  unread: number;
  hasInbound: boolean;
  flaggedCount: number;
  status: "open" | "archived";
  updatedAt: string;
};

function toConvo(i: Record<string, unknown>): MsgrConversation {
  const key = String(i.SK ?? i.key ?? "");
  const parsed = parseKey(key);
  return {
    key,
    platform: parsed?.platform ?? "messenger",
    psid: parsed?.psid ?? "",
    name: i.name ? String(i.name) : undefined,
    lastBody: String(i.lastBody ?? ""),
    lastDirection: i.lastDirection === "in" ? "in" : "out",
    lastAt: String(i.lastAt ?? i.updatedAt ?? ""),
    lastInboundAt: i.lastInboundAt ? String(i.lastInboundAt) : undefined,
    unread: Number(i.unread ?? 0),
    hasInbound: !!i.hasInbound,
    flaggedCount: Number(i.flaggedCount ?? 0),
    status: i.status === "archived" ? "archived" : "open",
    updatedAt: String(i.updatedAt ?? ""),
  };
}

function toMsg(i: Record<string, unknown>): MsgrMessage {
  return {
    id: String(i.id ?? ""),
    direction: i.direction === "in" ? "in" : "out",
    body: String(i.body ?? ""),
    mid: i.mid ? String(i.mid) : undefined,
    status: i.status ? String(i.status) : undefined,
    by: i.by ? String(i.by) : undefined,
    flagged: !!i.flagged,
    flaggedTerms: Array.isArray(i.flaggedTerms) ? (i.flaggedTerms as string[]) : undefined,
    createdAt: String(i.createdAt ?? ""),
  };
}

async function putMessage(key: string, m: MsgrMessage): Promise<void> {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.msgrThread(key), SK: `${m.createdAt}#${m.id}`, key, ...m } }),
  );
}

/** Persist an inbound message + bump the conversation. Returns the NEW unread count
 *  so the webhook alerts staff only on the first unread of a thread (burst throttle). */
export async function logInbound(input: {
  platform: MetaPlatform;
  psid: string;
  body: string;
  mid?: string;
  name?: string;
}): Promise<number> {
  if (!dbConfigured || !input.psid) return 0;
  const key = convoKey(input.platform, input.psid);
  const body = input.body ?? "";
  const { flagged, terms } = flagProfanity(body);
  const now = new Date().toISOString();
  await putMessage(key, {
    id: newId(),
    direction: "in",
    body,
    mid: input.mid,
    status: "received",
    flagged: flagged || undefined,
    flaggedTerms: flagged ? terms : undefined,
    createdAt: now,
  });
  const res = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: key },
      UpdateExpression:
        "SET platform = :pl, psid = :ps, lastBody = :b, lastDirection = :d, lastAt = :u, lastInboundAt = :u, updatedAt = :u, hasInbound = :t, #st = if_not_exists(#st, :open)" +
        (input.name ? ", #nm = :nm" : "") +
        " ADD unread :one, flaggedCount :fc",
      ExpressionAttributeNames: { "#st": "status", ...(input.name ? { "#nm": "name" } : {}) },
      ExpressionAttributeValues: {
        ":pl": input.platform,
        ":ps": input.psid,
        ":b": body.slice(0, SNIPPET),
        ":d": "in",
        ":u": now,
        ":t": true,
        ":open": "open",
        ":one": 1,
        ":fc": flagged ? 1 : 0,
        ...(input.name ? { ":nm": input.name } : {}),
      },
      ReturnValues: "ALL_NEW",
    }),
  );
  return Number(res.Attributes?.unread ?? 0);
}

/** Persist an outbound reply + bump the conversation (clears unread). */
export async function logOutbound(input: {
  platform: MetaPlatform;
  psid: string;
  body: string;
  mid?: string;
  status?: string;
  by?: string;
}): Promise<void> {
  if (!dbConfigured || !input.psid) return;
  const key = convoKey(input.platform, input.psid);
  const now = new Date().toISOString();
  await putMessage(key, {
    id: newId(),
    direction: "out",
    body: input.body,
    mid: input.mid,
    status: input.status ?? "sent",
    by: input.by,
    createdAt: now,
  });
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: key },
      UpdateExpression:
        "SET platform = :pl, psid = :ps, lastBody = :b, lastDirection = :d, lastAt = :u, updatedAt = :u, unread = :zero, #st = if_not_exists(#st, :open), hasInbound = if_not_exists(hasInbound, :f), flaggedCount = if_not_exists(flaggedCount, :z)",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":pl": input.platform,
        ":ps": input.psid,
        ":b": input.body.slice(0, SNIPPET),
        ":d": "out",
        ":u": now,
        ":zero": 0,
        ":open": "open",
        ":f": false,
        ":z": 0,
      },
    }),
  );
}

export async function listConversations(): Promise<MsgrConversation[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": CONVO_PK } }),
    );
    return (r.Items ?? []).map(toConvo).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  } catch {
    return [];
  }
}

export async function getConversation(key: string): Promise<MsgrConversation | null> {
  if (!dbConfigured || !key) return null;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: CONVO_PK, SK: key } }));
    return r.Item ? toConvo(r.Item) : null;
  } catch {
    return null;
  }
}

export async function getThread(key: string): Promise<MsgrMessage[]> {
  if (!dbConfigured || !key) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": PK.msgrThread(key) },
        ScanIndexForward: true, // oldest → newest
      }),
    );
    return (r.Items ?? []).map(toMsg);
  } catch {
    return [];
  }
}

export async function markRead(key: string): Promise<void> {
  if (!dbConfigured || !key) return;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: CONVO_PK, SK: key },
        UpdateExpression: "SET unread = :z, updatedAt = :u",
        ConditionExpression: "attribute_exists(SK)",
        ExpressionAttributeValues: { ":z": 0, ":u": new Date().toISOString() },
      }),
    );
  } catch {
    /* no conversation yet, or transient error — nothing to clear */
  }
}

export async function archiveConversation(key: string, archived = true): Promise<void> {
  if (!dbConfigured || !key) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: key },
      UpdateExpression: "SET #st = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":s": archived ? "archived" : "open", ":u": new Date().toISOString() },
    }),
  );
}

// ── Block list (PSID-keyed) ────────────────────────────────────────────────────
export type MsgrBlockRow = { key: string; blockedAt: string; by?: string; reason?: string };

export async function blockSender(input: { key: string; by?: string; reason?: string }): Promise<boolean> {
  if (!dbConfigured || !input.key) return false;
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: BLOCK_PK, SK: input.key, blockedAt: new Date().toISOString(), by: input.by, reason: input.reason } }),
  );
  return true;
}

export async function unblockSender(key: string): Promise<boolean> {
  if (!dbConfigured || !key) return false;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: BLOCK_PK, SK: key } }));
  return true;
}

/** Fail-open: a read error returns false so the webhook never wedges. */
export async function isSenderBlocked(key: string): Promise<boolean> {
  if (!dbConfigured || !key) return false;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: BLOCK_PK, SK: key } }));
    return !!r.Item;
  } catch {
    return false;
  }
}

// ── Reply gate ─────────────────────────────────────────────────────────────────
export type ReplyDecision = { allowed: boolean; reason?: string; windowEndsAt?: string };

/** PURE — may staff reply right now? Block wins. Otherwise the reply is allowed
 *  only inside Meta's 24h standard-messaging window since the person's last message;
 *  outside it (or if they never messaged us), Meta refuses a plain reply. */
export function canReplyNow(input: { blocked: boolean; lastInboundAt?: string }, now: Date = new Date()): ReplyDecision {
  if (input.blocked) return { allowed: false, reason: "This person is blocked. Unblock them first to reply." };
  if (!input.lastInboundAt) return { allowed: false, reason: "No inbound message yet — you can only reply to someone who messaged the campaign first." };
  const last = new Date(input.lastInboundAt).getTime();
  if (!Number.isFinite(last)) return { allowed: false, reason: "Can't determine the reply window — no valid inbound timestamp." };
  const endsAt = last + REPLY_WINDOW_MS;
  if (now.getTime() > endsAt)
    return {
      allowed: false,
      reason: "The 24-hour reply window has closed (Meta only allows a standard reply within 24h of their last message).",
      windowEndsAt: new Date(endsAt).toISOString(),
    };
  return { allowed: true, windowEndsAt: new Date(endsAt).toISOString() };
}
