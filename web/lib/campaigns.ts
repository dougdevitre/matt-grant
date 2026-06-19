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
const BATCH = 25;

export type CampaignStatus = "queued" | "sending" | "sent" | "failed";
type CampaignItem = {
  SK: string;
  id: string;
  createdAt: string;
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
  total: number;
  sentCount: number;
  suppressedCount: number;
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
        templateKey: input.templateKey,
        topic: input.topic,
        vars: input.vars,
        audience: input.audience,
        subjectPreview: input.subjectPreview,
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
      ScanIndexForward: false,
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
      subjectPreview: c.subjectPreview ?? "(campaign)",
      templateKey: c.templateKey,
      topic: c.topic,
      audience: c.audience,
      status: c.status,
      total: c.recipients?.length ?? 0,
      sentCount: c.sentCount ?? 0,
      suppressedCount: c.suppressedCount ?? 0,
      createdBy: c.createdBy,
    }));
  } catch {
    return [];
  }
}

// Send the next bounded batch of the oldest active campaign. Renders the template
// once, then sends to recipients not suppressed for this campaign's topic.
export async function drainOnce(
  base: string,
  batchSize = BATCH,
): Promise<{ id: string; sent: number; done: boolean; cursor: number; total: number } | null> {
  if (!dbConfigured) return null;
  const active = (await allCampaigns())
    .filter((c) => c.status === "queued" || c.status === "sending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
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

  const email = broadcast.build(active.vars ?? {});
  const recipients = active.recipients ?? [];
  const slice = recipients.slice(active.cursor, active.cursor + batchSize);
  let sent = active.sentCount ?? 0;
  let suppressed = active.suppressedCount ?? 0;
  for (const addr of slice) {
    if (await isSuppressed(addr, active.topic)) {
      suppressed++;
      continue;
    }
    const r = await sendBroadcastEmail({ to: addr, email, base });
    if (r.sent) sent++;
  }
  const cursor = active.cursor + slice.length;
  const done = cursor >= recipients.length;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: CAMPAIGN_PK, SK: active.SK },
      UpdateExpression:
        "SET #s = :s, #cur = :c, sentCount = :sent, suppressedCount = :sup, updatedAt = :u" + (done ? ", finishedAt = :f" : ""),
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
