// Per-staffer notification opt-outs (Phase 3a). Stored in their own DynamoDB partition
// (PK.notifPrefs, SK = email) so prefs are independent of the staff identity row — this lets an
// env-allowlist admin (who may have no staff row) still mute notifications, and never fabricates
// a staff row as a side effect. Opt-OUT model: absence of a row = subscribed to everything.
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

const norm = (e: string) => e.trim().toLowerCase();

/** The notification-type keys this staffer has muted. [] when none / unconfigured. */
export async function getMutedNotifications(email?: string | null): Promise<string[]> {
  if (!dbConfigured || !email) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p AND SK = :e",
        ExpressionAttributeValues: { ":p": PK.notifPrefs, ":e": norm(email) },
      }),
    );
    const muted = r.Items?.[0]?.muted;
    return Array.isArray(muted) ? (muted as string[]) : [];
  } catch {
    return [];
  }
}

/** Replace a staffer's muted set. Empty array = subscribed to all. */
export async function setMutedNotifications(email: string, muted: string[]): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: PK.notifPrefs, SK: norm(email), muted, updatedAt: new Date().toISOString() },
    }),
  );
}

/**
 * Emails that have MUTED a given notification type — one partition query, used by the triggers to
 * drop opted-out recipients. Returns an empty set on error/unconfigured (fail-open: a prefs blip
 * never silences a needed alert).
 */
export async function emailsMuting(type: string): Promise<Set<string>> {
  if (!dbConfigured) return new Set();
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.notifPrefs } }),
    );
    const out = new Set<string>();
    for (const it of r.Items ?? []) {
      if (Array.isArray(it.muted) && it.muted.includes(type)) out.add(String(it.SK));
    }
    return out;
  } catch {
    return new Set();
  }
}
