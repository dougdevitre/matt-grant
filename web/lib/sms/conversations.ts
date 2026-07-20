import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms/send";
import { consentStatus, type SmsConsentStatus } from "@/lib/sms/consent";
import { withCompliance } from "@/lib/sms/templates";
import { isBlocked, flagProfanity } from "@/lib/sms/moderation";
import { CAMPAIGN } from "@/lib/site";

// 1:1 SMS conversations — the two-way inbox. Two item types in the single table:
//   • Conversation index: PK="SMSCONVO", SK=<E.164> — one row per person, for the
//     inbox list (last message, unread count, flags).
//   • Thread message:     PK="SMSTHREAD#<E.164>", SK="<iso>#<id>" — one per text.
// Both reads are by PK (no GSI). A blocked number (lib/sms/moderation.ts) is inert:
// inbound is dropped at the webhook and outbound is refused here.
const CONVO_PK = PK.smsConvos;
const SNIPPET = 280; // cap the denormalized last-message preview

export type MsgDirection = "in" | "out";
export type SmsMessage = {
  id: string;
  direction: MsgDirection;
  body: string;
  sid?: string;
  status?: string; // "received" | "sent" | "failed"
  by?: string; // staff email (outbound)
  flagged?: boolean;
  flaggedTerms?: string[];
  createdAt: string;
};
export type SmsConversation = {
  phone: string;
  lastBody: string;
  lastDirection: MsgDirection;
  lastAt: string;
  unread: number;
  hasInbound: boolean;
  flaggedCount: number;
  linkedEmail?: string; // set once registered as a Clerk supporter
  identified?: boolean; // true once we've sent an identified outbound (sender name + STOP) in this thread
  awaiting?: "geo"; // the vote agent asked a question this thread hasn't answered yet
  awaitingAt?: string; // when it was asked — lib/sms/votebot.ts expires stale asks
  county?: string; // CountyKey (lib/sms/geo.ts), self-reported via the vote agent
  zip?: string; // self-reported ZIP5, when the person answered with one
  status: "open" | "archived";
  updatedAt: string;
};

function toConvo(i: Record<string, unknown>): SmsConversation {
  return {
    phone: String(i.SK ?? i.phone ?? ""),
    lastBody: String(i.lastBody ?? ""),
    lastDirection: i.lastDirection === "in" ? "in" : "out",
    lastAt: String(i.lastAt ?? i.updatedAt ?? ""),
    unread: Number(i.unread ?? 0),
    hasInbound: !!i.hasInbound,
    flaggedCount: Number(i.flaggedCount ?? 0),
    linkedEmail: i.linkedEmail ? String(i.linkedEmail) : undefined,
    identified: !!i.identified,
    awaiting: i.awaiting === "geo" ? "geo" : undefined,
    awaitingAt: i.awaitingAt ? String(i.awaitingAt) : undefined,
    county: i.county ? String(i.county) : undefined,
    zip: i.zip ? String(i.zip) : undefined,
    status: i.status === "archived" ? "archived" : "open",
    updatedAt: String(i.updatedAt ?? ""),
  };
}

function toMsg(i: Record<string, unknown>): SmsMessage {
  return {
    id: String(i.id ?? ""),
    direction: i.direction === "in" ? "in" : "out",
    body: String(i.body ?? ""),
    sid: i.sid ? String(i.sid) : undefined,
    status: i.status ? String(i.status) : undefined,
    by: i.by ? String(i.by) : undefined,
    flagged: !!i.flagged,
    flaggedTerms: Array.isArray(i.flaggedTerms) ? (i.flaggedTerms as string[]) : undefined,
    createdAt: String(i.createdAt ?? ""),
  };
}

async function putMessage(phone: string, m: SmsMessage): Promise<void> {
  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: { PK: PK.smsThread(phone), SK: `${m.createdAt}#${m.id}`, phone, ...m } }),
  );
}

/** Persist an inbound text into its thread + bump the conversation. Flags profanity.
 *  Returns the conversation's NEW unread count (0 on no-op) so the caller can alert
 *  staff only on the FIRST unread of a thread — throttling a burst to one notification. */
export async function logInbound(input: { from: string; body: string; sid?: string }): Promise<number> {
  const e = toE164(input.from);
  if (!dbConfigured || !e) return 0;
  const body = input.body ?? "";
  const { flagged, terms } = flagProfanity(body);
  const now = new Date().toISOString();
  await putMessage(e, {
    id: newId(),
    direction: "in",
    body,
    sid: input.sid,
    status: "received",
    flagged: flagged || undefined,
    flaggedTerms: flagged ? terms : undefined,
    createdAt: now,
  });
  const res = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: e },
      UpdateExpression:
        "SET phone = :ph, lastBody = :b, lastDirection = :d, lastAt = :u, updatedAt = :u, hasInbound = :t, #st = if_not_exists(#st, :open) ADD unread :one, flaggedCount :fc",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":ph": e,
        ":b": body.slice(0, SNIPPET),
        ":d": "in",
        ":u": now,
        ":t": true,
        ":open": "open",
        ":one": 1,
        ":fc": flagged ? 1 : 0,
      },
      ReturnValues: "ALL_NEW",
    }),
  );
  return Number(res.Attributes?.unread ?? 0);
}

/** Persist an outbound text into its thread + bump the conversation (clears unread). */
export async function logOutbound(input: { to: string; body: string; sid?: string; status?: string; by?: string }): Promise<void> {
  const e = toE164(input.to);
  if (!dbConfigured || !e) return;
  const now = new Date().toISOString();
  await putMessage(e, {
    id: newId(),
    direction: "out",
    body: input.body,
    sid: input.sid,
    status: input.status ?? "sent",
    by: input.by,
    createdAt: now,
  });
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: e },
      UpdateExpression:
        "SET phone = :ph, lastBody = :b, lastDirection = :d, lastAt = :u, updatedAt = :u, unread = :zero, identified = :t, #st = if_not_exists(#st, :open), hasInbound = if_not_exists(hasInbound, :f), flaggedCount = if_not_exists(flaggedCount, :z)",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":ph": e, ":b": input.body.slice(0, SNIPPET), ":d": "out", ":u": now, ":zero": 0, ":t": true, ":open": "open", ":f": false, ":z": 0 },
    }),
  );
}

/** Reflect a Twilio carrier delivery receipt on the matching 1:1 thread message.
 *  Finds the outbound message in `to`'s thread by its Twilio SID and sets its status
 *  (delivered/undelivered/failed/sent). No-op when the SID isn't in a thread (e.g. a
 *  broadcast or test send) or the DB is off. Best-effort; never throws. */
export async function updateMessageStatusBySid(to: string, sid: string, status: string): Promise<boolean> {
  const e = toE164(to);
  if (!dbConfigured || !e || !sid) return false;
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": PK.smsThread(e) },
      }),
    );
    const hit = (r.Items ?? []).find((i) => i.sid === sid);
    if (!hit) return false;
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.smsThread(e), SK: String(hit.SK) },
        UpdateExpression: "SET #st = :s",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":s": status },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function listConversations(): Promise<SmsConversation[]> {
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

export async function getConversation(phone: string): Promise<SmsConversation | null> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return null;
  try {
    const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: CONVO_PK, SK: e } }));
    return r.Item ? toConvo(r.Item) : null;
  } catch {
    return null;
  }
}

export async function getThread(phone: string): Promise<SmsMessage[]> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": PK.smsThread(e) },
        ScanIndexForward: true, // oldest → newest
      }),
    );
    return (r.Items ?? []).map(toMsg);
  } catch {
    return [];
  }
}

export async function markRead(phone: string): Promise<void> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: CONVO_PK, SK: e },
        UpdateExpression: "SET unread = :z, updatedAt = :u",
        ConditionExpression: "attribute_exists(SK)", // don't create a row just to mark read
        ExpressionAttributeValues: { ":z": 0, ":u": new Date().toISOString() },
      }),
    );
  } catch {
    /* no conversation yet, or a transient error — nothing to clear */
  }
}

export async function archiveConversation(phone: string, archived = true): Promise<void> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: e },
      UpdateExpression: "SET #st = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":s": archived ? "archived" : "open", ":u": new Date().toISOString() },
    }),
  );
}

/** Mark that the vote agent asked this thread its county/ZIP question. Upserts so
 *  the flag lands even before logInbound creates the conversation row. */
export async function setAwaitingGeo(phone: string): Promise<void> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return;
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: e },
      UpdateExpression: "SET phone = :ph, awaiting = :a, awaitingAt = :u, updatedAt = :u, #st = if_not_exists(#st, :open)",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":ph": e, ":a": "geo", ":u": now, ":open": "open" },
    }),
  );
}

/** Store a self-reported county (and ZIP, when given) and clear the open question.
 *  This is the conversation's geo memory: the next VOTE answers immediately. */
export async function setConversationGeo(phone: string, geo: { county: string; zip?: string }): Promise<void> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return;
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: e },
      UpdateExpression:
        "SET phone = :ph, county = :c, updatedAt = :u, #st = if_not_exists(#st, :open)" +
        (geo.zip ? ", zip = :z" : "") +
        " REMOVE awaiting, awaitingAt",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":ph": e,
        ":c": geo.county,
        ":u": now,
        ":open": "open",
        ...(geo.zip ? { ":z": geo.zip } : {}),
      },
    }),
  );
}

/** Record that a conversation's person was registered as a Clerk supporter. */
export async function linkConversationEmail(phone: string, email: string): Promise<void> {
  const e = toE164(phone);
  if (!dbConfigured || !e) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CONVO_PK, SK: e },
      UpdateExpression: "SET linkedEmail = :em, phone = :ph, updatedAt = :u, #st = if_not_exists(#st, :open)",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":em": email.toLowerCase(), ":ph": e, ":u": new Date().toISOString(), ":open": "open" },
    }),
  );
}

// ── The send gate ────────────────────────────────────────────────────────────────
export type SendDecision = { allowed: boolean; reason?: string; firstContact: boolean };

// PURE — given a number's moderation/consent state, decide whether staff may text
// it 1:1. Block wins over everything. Otherwise: opted-in may be cold-initiated;
// opted-out is refused; an unknown number may be replied to only if they texted us
// first (person-initiated = implied consent for that exchange). `firstContact`
// signals whether to append the STOP notice (cold opt-in initiation only).
export function decideCanSend(input: {
  blocked: boolean;
  consentStatus: SmsConsentStatus | "unknown";
  hasInbound: boolean;
}): SendDecision {
  if (input.blocked) return { allowed: false, reason: "This number is blocked. Unblock it first to message them.", firstContact: false };
  if (input.consentStatus === "opted_out")
    return { allowed: false, reason: "This number opted out (texted STOP). You can't message them.", firstContact: false };
  if (input.consentStatus === "opted_in") return { allowed: true, firstContact: !input.hasInbound };
  if (input.hasInbound) return { allowed: true, firstContact: false };
  return {
    allowed: false,
    reason: "This number hasn't opted in and hasn't texted us — they must opt in (text the keyword) before you can message them.",
    firstContact: true,
  };
}

export type DirectSendResult = { sent: boolean; reason?: string };

// Identify the campaign on the FIRST outbound of a thread so carriers (and the person)
// don't see an unlabeled number and flag it as spam — and ensure a one-time opt-out notice.
// GSM-7 (plain text) so it doesn't inflate the segment count. Later replies stay plain.
export function identifyReply(text: string): string {
  const withStop = /reply stop/i.test(text) ? text : `${text} Reply STOP to opt out.`;
  return `${CAMPAIGN.committee}: ${withStop}`;
}

/** Send a 1:1 text after the moderation + consent gate, logging the outcome. */
export async function sendDirectMessage(input: { to: string; body: string; by?: string }): Promise<DirectSendResult> {
  const e = toE164(input.to);
  if (!e) return { sent: false, reason: "Enter a valid US mobile number, e.g. +13145551234." };
  const text = input.body.trim();
  if (!text) return { sent: false, reason: "Write a message first." };

  const [blocked, status, convo] = await Promise.all([isBlocked(e), consentStatus(e), getConversation(e)]);
  const decision = decideCanSend({ blocked, consentStatus: status, hasInbound: !!convo?.hasInbound });
  if (!decision.allowed) return { sent: false, reason: decision.reason };

  // Cold first-contact (opted-in, no inbound): full disclaimer, which also identifies us.
  // First outbound of a person-initiated thread: prepend the sender name + a one-time STOP so
  // it isn't an "unknown sender". Every later reply is plain (short, GSM-7).
  const outBody = decision.firstContact
    ? withCompliance(text)
    : convo?.identified
      ? text
      : identifyReply(text);
  const r = await sendSms({ to: e, body: outBody });
  // Log the attempt either way so a failed send is visible in the thread.
  await logOutbound({ to: e, body: outBody, sid: r.sid, status: r.sent ? "sent" : "failed", by: input.by });
  return r.sent ? { sent: true } : { sent: false, reason: r.error ?? "Twilio send failed." };
}
