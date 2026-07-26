import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured, queryAllPages } from "@/lib/db";
import { sendSms } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";
import { isBlocked } from "@/lib/sms/moderation";
import { SMS_DRAIN_BATCH } from "@/lib/sms/pacing";

// Queued SMS broadcasts, drained in bounded batches by drainSmsOnce() (first batch
// inline + the /api/cron/sms-drain worker) — the same claim-before-send pattern as
// email campaigns (lib/campaigns.ts). Recipients are opted-in at queue time and
// RE-CHECKED at send (someone may text STOP in between). Sends only run inside the
// quiet-hours window; outside it the drain no-ops and resumes next window.
const SMS_PK = PK.smsCampaigns;
const BATCH = SMS_DRAIN_BATCH; // env-configurable (SMS_DRAIN_BATCH), bounded 1..60

export type SmsCampaignStatus = "scheduled" | "queued" | "sending" | "sent" | "failed";

type SmsCampaignItem = {
  SK: string;
  id: string;
  createdAt: string;
  scheduledAt?: string;
  body: string; // final text, compliance suffix already appended; may contain a {first} merge token
  audience: string;
  status: SmsCampaignStatus;
  // Opted-in-at-queue recipients. New rows store objects {phone, first?}; legacy rows are plain
  // E.164 strings — both are normalized at drain, so old campaigns keep sending unchanged.
  recipients: Array<string | { phone: string; first?: string }>;
  /** Recipient count, stored so list/selection reads never need the array itself.
   *  Absent on rows written before chunking shipped — fall back to recipients.length. */
  total?: number;
  /** 1-based position within a chunked blast, and how many chunks it was split
   *  into. Absent on single-item campaigns. */
  chunkIndex?: number;
  chunkOf?: number;
  cursor: number;
  sentCount: number;
  skippedCount: number; // opted-out/blocked since queueing (deliberately not sent)
  failedCount: number; // Twilio rejected the send (a real failure, distinct from a skip)
  // Carrier delivery receipts (recordCampaignDelivery). Distinct from sentCount,
  // which only means Twilio ACCEPTED the request.
  deliveredCount?: number;
  undeliveredCount?: number;
  createdBy: string;
  updatedAt?: string;
  finishedAt?: string;
};

/** Everything the list view and the drain's SELECTION step need — deliberately
 *  WITHOUT `recipients`, which is the whole point (see allSmsCampaignMetas). */
type SmsCampaignMeta = Omit<SmsCampaignItem, "recipients"> & { recipients?: never };

export type SmsCampaignSummary = {
  id: string;
  createdAt: string;
  body: string;
  audience: string;
  status: SmsCampaignStatus;
  scheduledAt?: string;
  total: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  deliveredCount: number;
  undeliveredCount: number;
  createdBy: string;
  chunkIndex?: number;
  chunkOf?: number;
};

// ── Audience chunking ────────────────────────────────────────────────────────
// A campaign's recipients live INSIDE its DynamoDB item, and an item is capped at
// 400 KB. Past that the PutItem is rejected outright — no campaign row, no partial
// send, just an error. So a large audience is split across several campaign rows.
//
// The drain processes one campaign at a time in (scheduledAt ?? createdAt) order,
// so chunks send back-to-back IN PRIORITY ORDER: the ranking done upstream
// (rankForBroadcast) is preserved across the split, and the highest-value
// recipients are still reached first. Each chunk's timestamp is nudged forward by
// its index so the ordering is total rather than a tie broken by a random uuid.

/** Byte budget for the recipients array. Well under DynamoDB's 400 KB item limit:
 *  the body, audience, and counters share the item, and an estimate that is close
 *  to the ceiling would fail for the least interesting reason imaginable. */
export const RECIPIENT_BYTES_BUDGET = 300_000;

/** Serialized size of one recipient, plus per-element overhead DynamoDB adds for
 *  the attribute-name/type wrappers on a map inside a list. Intentionally
 *  generous — over-estimating splits one extra time, under-estimating fails the
 *  whole send. */
export function recipientBytes(rec: string | { phone: string; first?: string }): number {
  const OVERHEAD = 24;
  if (typeof rec === "string") return rec.length + OVERHEAD;
  return rec.phone.length + (rec.first?.length ?? 0) + OVERHEAD;
}

/** Split recipients into chunks that each fit the byte budget, preserving order.
 *  A single recipient larger than the budget still gets its own chunk rather than
 *  being dropped — losing a recipient silently is the one unacceptable outcome. */
export function chunkRecipients<T extends string | { phone: string; first?: string }>(
  recipients: T[],
  budget = RECIPIENT_BYTES_BUDGET,
): T[][] {
  if (recipients.length === 0) return [];
  const chunks: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const rec of recipients) {
    const bytes = recipientBytes(rec);
    if (current.length > 0 && size + bytes > budget) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(rec);
    size += bytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

// SET → ADD ordering (DynamoDB rejects ADD-first). Extracted for unit testing,
// mirroring finalizeUpdateExpression in lib/campaigns.ts. When done, the terminal
// status value is bound to :sent by the caller (either "sent" or "failed").
export function finalizeSmsUpdateExpression(done: boolean): string {
  return "SET updatedAt = :u" + (done ? ", #s = :sent, finishedAt = :u" : "") + " ADD sentCount :sd, skippedCount :pd, failedCount :fd";
}

// Merge a recipient's first name into a body that carries the {first} token; a body without
// the token is returned unchanged (non-personalized campaigns are a no-op). Missing name → "there".
export function personalizeBody(body: string, first?: string): string {
  return body.includes("{first}") ? body.replace(/\{first\}/g, first || "there") : body;
}

// True when it's OK to send now: 9am–8pm Central (conservative TCPA quiet hours).
export function withinSendWindow(now: Date = new Date()): boolean {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hour12: false }).format(now),
  );
  return h >= 9 && h < 20;
}

export type CreatedSmsCampaign = {
  /** First chunk's id — the campaign an operator thinks of as "the send". */
  id: string;
  /** Every chunk id, in send order. */
  ids: string[];
  chunks: number;
  total: number;
};

/** Queue a campaign, splitting into as many chunk rows as the audience needs.
 *  Throws with an actionable message if a chunk is still rejected. */
export async function createSmsCampaign(input: {
  body: string;
  audience: string;
  recipients: Array<string | { phone: string; first?: string }>;
  createdBy: string;
  scheduledAt?: string;
}): Promise<CreatedSmsCampaign> {
  const base = Date.now();
  const chunks = chunkRecipients(input.recipients);
  const ids: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const id = newId();
    // Nudge each chunk's timestamps forward by its index so both the SK and the
    // drain's sort key order them deterministically. Without this every chunk
    // shares a timestamp and the tie-break is a random uuid — which would send
    // the audience out of priority order.
    const createdAt = new Date(base + i).toISOString();
    const scheduledAt = input.scheduledAt
      ? new Date(new Date(input.scheduledAt).getTime() + i).toISOString()
      : undefined;
    const scheduled = !!scheduledAt && scheduledAt > createdAt;
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: SMS_PK,
            SK: `${createdAt}#${id}`,
            id,
            createdAt,
            ...(scheduledAt ? { scheduledAt } : {}),
            body: input.body,
            audience: input.audience,
            status: scheduled ? "scheduled" : "queued",
            recipients: chunks[i],
            total: chunks[i].length,
            ...(chunks.length > 1 ? { chunkIndex: i + 1, chunkOf: chunks.length } : {}),
            cursor: 0,
            sentCount: 0,
            skippedCount: 0,
            failedCount: 0,
            createdBy: input.createdBy,
          },
        }),
      );
    } catch (e) {
      // Surface the real cause. The generic server-action error this used to
      // produce told the operator nothing, and the fix is never obvious.
      const name = (e as { name?: string })?.name ?? "error";
      throw new Error(
        `Failed to queue chunk ${i + 1} of ${chunks.length} (${chunks[i].length} recipients): ${name}. ` +
          `${ids.length} earlier chunk(s) were already queued and will still send.`,
        { cause: e },
      );
    }
    ids.push(id);
  }

  return { id: ids[0] ?? "", ids, chunks: chunks.length, total: input.recipients.length };
}

/** Campaign rows WITHOUT their recipients arrays.
 *
 *  This projection is load-bearing, not an optimization. Both the dashboard list
 *  and the drain's campaign-selection step used to pull every historical
 *  campaign's full recipients array — on every page render and up to three times
 *  a minute, forever. With real send volume that read grows without bound. The
 *  drain fetches the chosen row's recipients separately (see drainSmsOnce). */
async function allSmsCampaignMetas(): Promise<SmsCampaignMeta[]> {
  // Paginate: ScanIndexForward:false ordering is preserved across pages.
  return (await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": SMS_PK },
    ScanIndexForward: false,
    // #st/#tot are reserved words; the rest are projected verbatim.
    ProjectionExpression:
      "SK, id, createdAt, scheduledAt, body, audience, #st, #tot, chunkIndex, chunkOf, cursor, sentCount, skippedCount, failedCount, deliveredCount, undeliveredCount, createdBy, updatedAt, finishedAt",
    ExpressionAttributeNames: { "#st": "status", "#tot": "total" },
  })) as SmsCampaignMeta[];
}

/** Recipient count for a row. Rows written before chunking shipped carry no
 *  `total`, and the projection deliberately omits `recipients` — so reconstruct
 *  from progress instead. For a finished legacy campaign
 *  (sent + skipped + failed) is exact; for one still draining, `cursor` is a
 *  lower bound. Better a slightly low count on an old row than reading every
 *  recipient array on every render. */
function metaTotal(c: {
  total?: number;
  recipients?: unknown[];
  cursor?: number;
  sentCount?: number;
  skippedCount?: number;
  failedCount?: number;
}): number {
  if (typeof c.total === "number") return c.total;
  if (c.recipients) return c.recipients.length;
  const processed = (c.sentCount ?? 0) + (c.skippedCount ?? 0) + (c.failedCount ?? 0);
  return Math.max(c.cursor ?? 0, processed);
}

export async function listSmsCampaigns(limit = 15): Promise<SmsCampaignSummary[]> {
  if (!dbConfigured) return [];
  try {
    return (await allSmsCampaignMetas()).slice(0, limit).map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      body: c.body,
      audience: c.audience,
      status: c.status,
      scheduledAt: c.scheduledAt,
      total: metaTotal(c),
      sentCount: c.sentCount ?? 0,
      skippedCount: c.skippedCount ?? 0,
      failedCount: c.failedCount ?? 0,
      deliveredCount: c.deliveredCount ?? 0,
      undeliveredCount: c.undeliveredCount ?? 0,
      createdBy: c.createdBy,
      ...(c.chunkIndex ? { chunkIndex: c.chunkIndex, chunkOf: c.chunkOf } : {}),
    }));
  } catch {
    return [];
  }
}

/** Tally a delivery receipt against a campaign.
 *
 *  `sentCount` has always meant "Twilio accepted the API call" — not "the handset
 *  received it". These counters are the difference, and for a broadcast they are
 *  the ONLY delivery signal: broadcasts create no 1:1 thread row, so the status
 *  webhook previously had nowhere to put the receipt and dropped it.
 *
 *  Best-effort by design: a receipt for a deleted campaign no-ops rather than
 *  failing the callback (Twilio would retry a failure indefinitely). */
export async function recordCampaignDelivery(campaignKey: string, status: string): Promise<boolean> {
  if (!dbConfigured || !campaignKey) return false;
  const attr = status === "delivered" ? "deliveredCount" : "undeliveredCount";
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: SMS_PK, SK: campaignKey },
        UpdateExpression: `SET updatedAt = :u ADD ${attr} :one`,
        ConditionExpression: "attribute_exists(SK)",
        ExpressionAttributeValues: { ":one": 1, ":u": new Date().toISOString() },
      }),
    );
    return true;
  } catch {
    return false; // unknown/deleted campaign — nothing to tally
  }
}

// Send the next bounded batch of the oldest active SMS campaign. Returns null when
// there's nothing to do — including during quiet hours, so the cron just waits.
export async function drainSmsOnce(
  batchSize = BATCH,
): Promise<{ id: string; sent: number; done: boolean; cursor: number; total: number } | null> {
  if (!dbConfigured) return null;
  if (!withinSendWindow()) return null; // quiet hours — resume next window

  const nowIso = new Date().toISOString();
  // SELECT on the projection (no recipient arrays), then fetch only the winner's
  // recipients. Chunks of one blast share a body and audience and are ordered by
  // their nudged timestamps, so they drain back-to-back in priority order.
  const selected = (await allSmsCampaignMetas())
    .filter(
      (c) =>
        c.status === "queued" ||
        c.status === "sending" ||
        (c.status === "scheduled" && (c.scheduledAt ?? "") <= nowIso),
    )
    .sort((a, b) => (a.scheduledAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.createdAt))[0];
  if (!selected) return null;

  const full = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: SMS_PK, SK: selected.SK } }));
  const active = (full.Item ?? selected) as SmsCampaignItem;
  const recipients = active.recipients ?? [];
  const start = active.cursor ?? 0;
  const now = new Date().toISOString();

  if (start >= recipients.length) {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: SMS_PK, SK: active.SK },
        UpdateExpression: "SET #s = :sent, finishedAt = :u, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":sent": "sent", ":u": now },
      }),
    );
    return { id: active.id, sent: active.sentCount ?? 0, done: true, cursor: start, total: recipients.length };
  }

  const end = Math.min(start + batchSize, recipients.length);

  // Claim [start,end) atomically so the inline send + the cron worker never send
  // the same numbers twice.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: SMS_PK, SK: active.SK },
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

  let sentDelta = 0;
  let skippedDelta = 0;
  let failedDelta = 0;
  for (const rec of recipients.slice(start, end)) {
    // Normalize legacy string recipients + new {phone, first?} objects the same way.
    const phone = typeof rec === "string" ? rec : rec.phone;
    const first = typeof rec === "string" ? undefined : rec.first;
    if (!(await isOptedIn(phone)) || (await isBlocked(phone))) {
      skippedDelta++; // opted out or blocked since queueing — deliberately not sent
      continue;
    }
    // campaignKey rides the StatusCallback URL so the delivery receipt can be
    // attributed back to this campaign (broadcasts have no 1:1 thread to land on).
    const r = await sendSms({ to: phone, body: personalizeBody(active.body, first), campaignKey: active.SK });
    if (r.sent) sentDelta++;
    else failedDelta++; // Twilio rejected it — a real failure, not a skip
  }

  const done = end >= recipients.length;
  // A finished campaign that sent nothing but hit failures is "failed"; otherwise "sent".
  const totalSent = (active.sentCount ?? 0) + sentDelta;
  const totalFailed = (active.failedCount ?? 0) + failedDelta;
  const terminal = totalSent === 0 && totalFailed > 0 ? "failed" : "sent";
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: SMS_PK, SK: active.SK },
      UpdateExpression: finalizeSmsUpdateExpression(done),
      ...(done ? { ExpressionAttributeNames: { "#s": "status" } } : {}),
      ExpressionAttributeValues: { ":sd": sentDelta, ":pd": skippedDelta, ":fd": failedDelta, ":u": now, ...(done ? { ":sent": terminal } : {}) },
    }),
  );
  return { id: active.id, sent: totalSent, done, cursor: end, total: recipients.length };
}
