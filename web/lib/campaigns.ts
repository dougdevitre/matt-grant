import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";

// Send log for broadcast campaigns (email-campaign-plan §6): what went out, to
// whom, by whom, when. Newest-first via an ISO-prefixed sort key.
const CAMPAIGN_PK = "CAMPAIGN#sent";

export type SentCampaign = {
  at: string;
  subject: string;
  audience: string;
  sentBy: string;
  recipients: number;
  suppressed: number;
};

export async function logCampaign(c: SentCampaign): Promise<void> {
  if (!dbConfigured) return;
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: CAMPAIGN_PK, SK: `${c.at}#${newId()}`, ...c } }));
  } catch {
    /* non-critical */
  }
}

export async function listCampaigns(limit = 15): Promise<SentCampaign[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": CAMPAIGN_PK },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (r.Items ?? []).map((i) => ({
      at: String(i.at),
      subject: String(i.subject),
      audience: String(i.audience),
      sentBy: String(i.sentBy),
      recipients: Number(i.recipients ?? 0),
      suppressed: Number(i.suppressed ?? 0),
    }));
  } catch {
    return [];
  }
}
