// Phase-5 canvass-ID write-back (voter-file-plan.md §4/Phase 5): IDs from a
// returned walk sheet update the voter rows in ONE precinct shard — s and
// segment are RECOMPUTED (real label beats the party proxy) — then the
// precinct's VOTERAGG rollup is re-aggregated with the exact same math the
// ingest uses (lib/voters/aggregate.ts), so every dashboard surface moves.
import "server-only";
import { UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured, voterIdxShard } from "@/lib/db";
import { aggregateVoters } from "./aggregate";
import { tierShift } from "./chase";
import { applyTierShift, listReturnRowsByPrecinct } from "./returnsStore";
import { segmentFor, sFromCanvassId } from "./score";
import { listVotersByPrecinct } from "./store";

export type CanvassEntry = { voterId: string; canvassId: number }; // 1-5

export type CanvassResult = {
  updated: number;
  // Banked ballots whose chase-tier counter moved because the new ID changed
  // the segment (BALLOTAGG reconciliation — keeps the chase board truthful).
  retiered: number;
  unknownIds: string[]; // voter ids not in this precinct — reported, never guessed
};

/**
 * Apply canvass IDs to one precinct. Reads the shard once (validates IDs and
 * supplies each voter's T for the segment recompute), updates each row with an
 * attribute_exists guard, then rewrites the precinct's VOTERAGG.
 */
export async function recordCanvassIds(
  precinctKey: string,
  entries: CanvassEntry[],
  by: string,
): Promise<CanvassResult> {
  if (!dbConfigured || !precinctKey || entries.length === 0) return { updated: 0, retiered: 0, unknownIds: [] };
  const [voters, returnRows] = await Promise.all([
    listVotersByPrecinct(precinctKey),
    listReturnRowsByPrecinct(precinctKey),
  ]);
  const byId = new Map(voters.map((v) => [v.voterId, v]));
  const returnById = new Map(returnRows.map((r) => [r.voterId, r]));
  const now = new Date().toISOString();
  const unknownIds: string[] = [];
  let updated = 0;
  let retiered = 0;

  for (const e of entries) {
    const v = byId.get(e.voterId);
    const canvassId = Math.round(e.canvassId);
    if (!v || canvassId < 1 || canvassId > 5) {
      unknownIds.push(e.voterId);
      continue;
    }
    const s = sFromCanvassId(canvassId);
    const segment = segmentFor(v.t, s);
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: PK.voterShard(precinctKey), SK: v.voterId },
          UpdateExpression: "SET canvassId = :c, canvassAt = :at, canvassBy = :by, s = :s, segment = :seg",
          ConditionExpression: "attribute_exists(SK)",
          ExpressionAttributeValues: { ":c": canvassId, ":at": now, ":by": by, ":s": s, ":seg": segment },
        }),
      );
      // Keep the ID index in step (the returns import reads segment/t from it).
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { PK: PK.voterIdx(voterIdxShard(v.voterId)), SK: v.voterId, precinctKey, segment, t: v.t },
        }),
      );
      // A banked ballot whose tier just changed: move its BALLOTAGG counter
      // (else banked-per-tier drifts from universe-per-tier and the chase
      // board can show negative outstanding).
      const ret = returnById.get(v.voterId);
      if (ret) {
        const shift = tierShift(ret.segment, ret.t, segment, v.t);
        if (shift) {
          await applyTierShift(precinctKey, v.voterId, shift, segment, v.t);
          retiered++;
        }
      }
      // Mirror into the in-memory copy so the re-aggregation below sees it.
      v.s = s;
      v.segment = segment;
      v.canvassId = canvassId;
      updated++;
    } catch {
      unknownIds.push(e.voterId);
    }
  }

  if (updated > 0) {
    const agg = aggregateVoters(voters, voters[0]?.county ?? "");
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: PK.voterAgg, SK: precinctKey, ...agg, updatedAt: now },
      }),
    );
  }
  return { updated, retiered, unknownIds };
}
