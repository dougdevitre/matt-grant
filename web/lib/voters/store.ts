// Read-side store for the voter engine (candidate/voter-file-plan.md §3).
// The dashboard reads VOTERAGG rollups (≈178 items) for everything district-
// wide; individual voters are only ever queried ONE PRECINCT SHARD at a time
// (a few thousand rows) — never the whole 577k partition space. Writes happen
// exclusively in scripts/ingest-voters.ts.
import "server-only";
import { TABLE, PK, dbConfigured, queryAllPages } from "@/lib/db";
import type { Segment } from "./score";
import type { StoredVoter, VoterAggRow } from "./storeTypes";

export type { StoredVoter, VoterAggRow } from "./storeTypes";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** All per-precinct rollups. [] when the DB is unconfigured, empty, or errors. */
export async function listVoterAggs(): Promise<VoterAggRow[]> {
  if (!dbConfigured) return [];
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.voterAgg },
    });
    return items
      .map((it): VoterAggRow | null => {
        const precinctKey = typeof it.SK === "string" ? it.SK : "";
        if (!precinctKey) return null;
        return {
          precinctKey,
          county: typeof it.county === "string" ? it.county : "",
          count: num(it.count),
          active: num(it.active),
          t: Array.isArray(it.t) ? (it.t as unknown[]).map(num) : [0, 0, 0, 0, 0, 0],
          seg: (it.seg && typeof it.seg === "object" ? it.seg : {}) as Record<Segment, number>,
          age: (it.age && typeof it.age === "object" ? it.age : {}) as Record<string, number>,
          newReg: num(it.newReg),
        };
      })
      .filter((r): r is VoterAggRow => r !== null)
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/** Every voter in ONE precinct shard (bounded: a few thousand rows). */
export async function listVotersByPrecinct(precinctKey: string): Promise<StoredVoter[]> {
  if (!dbConfigured || !precinctKey) return [];
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.voterShard(precinctKey) },
    });
    return items
      .map((it): StoredVoter | null => {
        const voterId = typeof it.SK === "string" ? it.SK : "";
        if (!voterId) return null;
        return {
          voterId,
          firstName: typeof it.firstName === "string" ? it.firstName : "",
          lastName: typeof it.lastName === "string" ? it.lastName : "",
          address: typeof it.address === "string" ? it.address : "",
          ...(typeof it.unit === "string" ? { unit: it.unit } : {}),
          city: typeof it.city === "string" ? it.city : "",
          zip: typeof it.zip === "string" ? it.zip : "",
          county: typeof it.county === "string" ? it.county : "",
          precinctName: typeof it.precinctName === "string" ? it.precinctName : "",
          yob: typeof it.yob === "number" ? it.yob : null,
          ...(typeof it.party === "string" ? { party: it.party } : {}),
          active: it.active === true,
          lastVoted:
            it.lastVoted && typeof it.lastVoted === "object"
              ? (it.lastVoted as StoredVoter["lastVoted"])
              : null,
          t: num(it.t),
          s: num(it.s),
          segment: (typeof it.segment === "string" ? it.segment : "MONITOR") as Segment,
          newRegistrant: it.newRegistrant === true,
        };
      })
      .filter((r): r is StoredVoter => r !== null)
      .sort((a, b) => a.address.localeCompare(b.address) || a.lastName.localeCompare(b.lastName));
  } catch {
    return [];
  }
}

/** The most recent ingest manifest (run metadata), or null. */
export async function latestIngestRun(): Promise<Record<string, unknown> | null> {
  if (!dbConfigured) return null;
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.ingestRuns("voters") },
    });
    return (items.sort((a, b) => String(b.SK).localeCompare(String(a.SK)))[0] as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}
