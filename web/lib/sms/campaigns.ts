import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured, queryAllPages } from "@/lib/db";
import { sendSms } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";
import { isBlocked } from "@/lib/sms/moderation";

// Queued SMS broadcasts, drained in bounded batches by drainSmsOnce() (first batch
// inline + the /api/cron/sms-drain worker) — the same claim-before-send pattern as
// email campaigns (lib/campaigns.ts). Recipients are opted-in at queue time and
// RE-CHECKED at send (someone may text STOP in between). Sends only run inside the
// quiet-hours window; outside it the drain no-ops and resumes next window.
const SMS_PK = PK.smsCampaigns;
const BATCH = 10; // small — respect Twilio messaging-service throughput

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
  cursor: number;
  sentCount: number;
  skippedCount: number; // opted-out/blocked since queueing (deliberately not sent)
  failedCount: number; // Twilio rejected the send (a real failure, distinct from a skip)
  createdBy: string;
  updatedAt?: string;
  finishedAt?: string;
};

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
  createdBy: string;
};

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

export async function createSmsCampaign(input: {
  body: string;
  audience: string;
  recipients: Array<string | { phone: string; first?: string }>;
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
        PK: SMS_PK,
        SK: `${createdAt}#${id}`,
        id,
        createdAt,
        ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
        body: input.body,
        audience: input.audience,
        status: scheduled ? "scheduled" : "queued",
        recipients: input.recipients,
        cursor: 0,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        createdBy: input.createdBy,
      },
    }),
  );
  return id;
}

async function allSmsCampaigns(): Promise<SmsCampaignItem[]> {
  // Paginate: like email campaigns, each row embeds the full recipients[] array,
  // so a single query page would strand any SMS campaign past the 1 MB boundary
  // and it would never drain. queryAllPages keeps ScanIndexForward:false ordering.
  return (await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": SMS_PK },
    ScanIndexForward: false,
  })) as SmsCampaignItem[];
}

export async function listSmsCampaigns(limit = 15): Promise<SmsCampaignSummary[]> {
  if (!dbConfigured) return [];
  try {
    return (await allSmsCampaigns()).slice(0, limit).map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      body: c.body,
      audience: c.audience,
      status: c.status,
      scheduledAt: c.scheduledAt,
      total: c.recipients?.length ?? 0,
      sentCount: c.sentCount ?? 0,
      skippedCount: c.skippedCount ?? 0,
      failedCount: c.failedCount ?? 0,
      createdBy: c.createdBy,
    }));
  } catch {
    return [];
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
  const active = (await allSmsCampaigns())
    .filter(
      (c) =>
        c.status === "queued" ||
        c.status === "sending" ||
        (c.status === "scheduled" && (c.scheduledAt ?? "") <= nowIso),
    )
    .sort((a, b) => (a.scheduledAt ?? a.createdAt).localeCompare(b.scheduledAt ?? b.createdAt))[0];
  if (!active) return null;

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
    const r = await sendSms({ to: phone, body: personalizeBody(active.body, first) });
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
