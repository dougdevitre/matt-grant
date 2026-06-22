import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";
import type { ChannelId } from "@/lib/social/channels";
import type { FootprintReport } from "@/lib/social/optimize";

// Footprint history — a time series of the dominance index so the campaign can
// see the trend, not just a point-in-time score. One partition (FOOTPRINT), sort
// key `${ISO}#${id}` so a descending query returns newest-first. Mirrors the
// append-only audit trail in lib/audit.ts; snapshots are non-critical, so a write
// failure never blocks the analysis the admin just ran.
const FOOTPRINT_PK = "FOOTPRINT";

export type FootprintSnapshot = {
  at: string;
  index: number;
  totalFollowers: number;
  totalImpressions30d: number;
  totalConversions30d: number;
  channelHealth: Partial<Record<ChannelId, number>>;
  takenBy: string;
};

export async function recordSnapshot(report: FootprintReport, takenBy: string): Promise<void> {
  if (!dbConfigured) return;
  const channelHealth: Partial<Record<ChannelId, number>> = {};
  for (const c of report.channels) channelHealth[c.channel] = c.health;
  const at = new Date().toISOString();
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: FOOTPRINT_PK,
          SK: `${at}#${newId()}`,
          at,
          index: report.index,
          totalFollowers: report.totalFollowers,
          totalImpressions30d: report.totalImpressions30d,
          totalConversions30d: report.totalConversions30d,
          channelHealth,
          takenBy,
        },
      }),
    );
  } catch {
    /* snapshot history is non-critical */
  }
}

export async function listSnapshots(limit = 12): Promise<FootprintSnapshot[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": FOOTPRINT_PK },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );
    return (r.Items ?? []).map((i) => ({
      at: String(i.at),
      index: Number(i.index ?? 0),
      totalFollowers: Number(i.totalFollowers ?? 0),
      totalImpressions30d: Number(i.totalImpressions30d ?? 0),
      totalConversions30d: Number(i.totalConversions30d ?? 0),
      channelHealth: (i.channelHealth ?? {}) as Partial<Record<ChannelId, number>>,
      takenBy: String(i.takenBy ?? "system"),
    }));
  } catch {
    return [];
  }
}
