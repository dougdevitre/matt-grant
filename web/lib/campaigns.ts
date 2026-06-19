import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";
import { isSuppressed } from "@/lib/subscribers";
import { sendCampaignEmail } from "@/lib/campaignSend";

// Broadcast campaigns are queued, then sent in bounded batches by drainOnce()
// (called inline for the first batch + by the /api/cron/email-drain worker) so a
// large list never blocks a single request past the function timeout.
const CAMPAIGN_PK = "CAMPAIGN";
const BATCH = 25;

export type CampaignStatus = "queued" | "sending" | "sent" | "failed";
type CampaignItem = {
  SK: string;
  id: string;
  createdAt: string;
  subject: string;
  body: string;
  audience: string;
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
  subject: string;
  audience: string;
  status: CampaignStatus;
  total: number;
  sentCount: number;
  suppressedCount: number;
  createdBy: string;
  finishedAt?: string;
};

export async function createCampaign(input: {
  subject: string;
  body: string;
  audience: string;
  recipients: string[];
  createdBy: string;
}): Promise<string> {
  const id = newId();
  const createdAt = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: CAMPAIGN_PK,
        SK: `${createdAt}#${id}`,
        id,
        createdAt,
        subject: input.subject,
        body: input.body,
        audience: input.audience,
        status: "queued",
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
      ScanIndexForward: false, // newest first
    }),
  );
  return (r.Items ?? []) as CampaignItem[];
}

export async function listCampaigns(limit = 15): Promise<CampaignSummary[]> {
  if (!dbConfigured) return [];
  try {
    return (await allCampaigns()).slice(0, limit).map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      subject: c.subject,
      audience: c.audience,
      status: c.status,
      total: c.recipients?.length ?? 0,
      sentCount: c.sentCount ?? 0,
      suppressedCount: c.suppressedCount ?? 0,
      createdBy: c.createdBy,
      finishedAt: c.finishedAt,
    }));
  } catch {
    return [];
  }
}

// Send the next bounded batch of the oldest active campaign. Returns null when
// there's nothing to do. Each call is O(BATCH) sends, so it stays well under any
// serverless timeout regardless of list size.
export async function drainOnce(
  base: string,
  batchSize = BATCH,
): Promise<{ id: string; sent: number; done: boolean; cursor: number; total: number } | null> {
  if (!dbConfigured) return null;
  const active = (await allCampaigns())
    .filter((c) => c.status === "queued" || c.status === "sending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (!active) return null;

  const recipients = active.recipients ?? [];
  const slice = recipients.slice(active.cursor, active.cursor + batchSize);
  let sent = active.sentCount ?? 0;
  let suppressed = active.suppressedCount ?? 0;
  for (const e of slice) {
    if (await isSuppressed(e)) {
      suppressed++;
      continue;
    }
    const r = await sendCampaignEmail({ to: e, subject: active.subject, body: active.body, base });
    if (r.sent) sent++;
  }
  const cursor = active.cursor + slice.length;
  const done = cursor >= recipients.length;
  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CAMPAIGN_PK, SK: active.SK },
      UpdateExpression:
        "SET #s = :s, #cur = :c, sentCount = :sent, suppressedCount = :sup, updatedAt = :u" +
        (done ? ", finishedAt = :f" : ""),
      ExpressionAttributeNames: { "#s": "status", "#cur": "cursor" },
      ExpressionAttributeValues: {
        ":s": done ? "sent" : "sending",
        ":c": cursor,
        ":sent": sent,
        ":sup": suppressed,
        ":u": now,
        ...(done ? { ":f": now } : {}),
      },
    }),
  );
  return { id: active.id, sent, done, cursor, total: recipients.length };
}
