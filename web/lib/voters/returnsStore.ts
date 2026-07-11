// Ballot-returns store (voter-file-plan.md Phase 5): the county's daily
// early-vote/absentee file marks voters "banked". Each voter id resolves
// through the VOTERIDX shard (GetItem — never a scan), the return row lands in
// its precinct's BALLOTRETURN partition with a conditional put (re-importing a
// cumulative daily file is idempotent), and only a FIRST insert increments the
// BALLOTAGG per-precinct counters the chase board reads (~213 rows).
import "server-only";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured, queryAllPages, voterIdxShard } from "@/lib/db";
import { chaseTier, type BallotAggRow, type ChaseTier, type ReturnRow } from "./chase";
import type { Segment } from "./score";

export type ImportReturnsResult = {
  banked: number; // newly recorded
  duplicates: number; // already banked (idempotent re-import)
  unmatched: string[]; // voter ids with no index row — reported, never guessed
};

type IdxRow = { precinctKey: string; segment: Segment; t: number };

async function lookupIdx(voterId: string): Promise<IdxRow | null> {
  const out = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: PK.voterIdx(voterIdxShard(voterId)), SK: voterId } }),
  );
  const it = out.Item;
  if (!it || typeof it.precinctKey !== "string") return null;
  return {
    precinctKey: it.precinctKey,
    segment: (typeof it.segment === "string" ? it.segment : "MONITOR") as Segment,
    t: typeof it.t === "number" ? it.t : 0,
  };
}

/** Record returned ballots. Duplicate voter ids (within the paste or vs prior
 *  imports) count once — the conditional put is the idempotency gate. */
export async function importReturns(rows: ReturnRow[], by: string): Promise<ImportReturnsResult> {
  if (!dbConfigured) return { banked: 0, duplicates: 0, unmatched: rows.map((r) => r.voterId) };
  const now = new Date().toISOString();
  let banked = 0;
  let duplicates = 0;
  const unmatched: string[] = [];

  for (const r of rows) {
    const idx = await lookupIdx(r.voterId);
    if (!idx) {
      unmatched.push(r.voterId);
      continue;
    }
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: PK.ballotReturns(idx.precinctKey),
            SK: r.voterId,
            segment: idx.segment,
            t: idx.t,
            ...(r.votedAt ? { votedAt: r.votedAt } : {}),
            ...(r.method ? { method: r.method } : {}),
            importedAt: now,
            importedBy: by,
          },
          ConditionExpression: "attribute_not_exists(SK)",
        }),
      );
    } catch {
      duplicates++; // conditional-check failure = already banked
      continue;
    }
    // First insert only: bump the precinct's banked counters.
    const tier = chaseTier(idx.segment, idx.t);
    const adds = tier ? `banked :one, t${tier} :one` : "banked :one";
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.ballotAgg, SK: idx.precinctKey },
        UpdateExpression: `ADD ${adds} SET updatedAt = :now`,
        ExpressionAttributeValues: { ":one": 1, ":now": now },
      }),
    );
    banked++;
  }
  return { banked, duplicates, unmatched };
}

/** Per-precinct banked counters for the chase board. [] pre-returns. */
export async function listBallotAggs(): Promise<BallotAggRow[]> {
  if (!dbConfigured) return [];
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.ballotAgg },
    });
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return items
      .map((it): BallotAggRow | null => {
        const precinctKey = typeof it.SK === "string" ? it.SK : "";
        if (!precinctKey) return null;
        const tiers = {} as Record<ChaseTier, number>;
        for (const t of ["1", "2", "3", "4"] as const) tiers[t] = num(it[`t${t}`]);
        return { precinctKey, banked: num(it.banked), tiers };
      })
      .filter((r): r is BallotAggRow => r !== null);
  } catch {
    return [];
  }
}
