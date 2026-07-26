// Vendor-source OVERLAY reads (candidate/voter-registry-refresh-plan.md §3).
//
// A second-source export (a commercial or party-committee file) carries
// attributes the official Sunshine-law file does not: real primary vote history
// and an inferred party. Those land in their own partition, VOTEROVL#<precinct>
// keyed by the same Voter ID as the spine, rather than mutating VOTER# rows.
//
// Why a separate partition:
//   • VOTERAGG is recomputed WHOLESALE from all official files in one pass
//     (candidate/voter-file-plan.md §3). Folding a partial, Republican-only
//     universe into that pass would corrupt the district denominators, the
//     six-county census, and the chase board's outstanding math.
//   • It is reversible — delete the partition and the spine is untouched.
//   • Provenance stays explicit: every overlay row records which source wrote it.
//
// The overlay is EMPTY until an overlay source is ingested. Every consumer must
// treat a miss as "unknown", never as a default — an absent primary propensity
// is not a zero, and an absent party is not "other".
import { PK, TABLE, dbConfigured, queryAllPages } from "@/lib/db";
import { batchWritePut } from "@/lib/integrations/batchWrite";
import { isVoterPartyCode } from "@/lib/voters/party";

export type VoterOverlay = {
  voterId: string;
  /** Primary propensity 0-5 — count of recent August primaries voted, capped.
   *  Sharper than the spine's recency-based turnout score `t` for a primary. */
  pp?: number;
  /** Canonical party code. ALWAYS INFERRED — Missouri has no party
   *  registration (lib/voters/party.ts). */
  party?: string;
  /** Which source file wrote this row, for lineage. */
  source?: string;
};

const num0to5 = (v: unknown): number | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  return n >= 0 && n <= 5 ? n : undefined;
};

/** Parse a raw DynamoDB item into an overlay row, dropping anything malformed
 *  rather than passing a bad value downstream into targeting. */
export function toVoterOverlay(raw: Record<string, unknown>): VoterOverlay | null {
  const voterId = String(raw.SK ?? "");
  if (!voterId) return null;
  const party = typeof raw.party === "string" && isVoterPartyCode(raw.party) ? raw.party : undefined;
  return {
    voterId,
    pp: num0to5(raw.pp),
    party,
    source: typeof raw.source === "string" ? raw.source : undefined,
  };
}

/** Upsert overlay rows for one precinct. Keyed by Voter ID, so re-running the
 *  same file UPDATES rather than duplicating — the ingest stays idempotent.
 *  Rows with no voterId are the caller's problem to resolve first (the name+ZIP
 *  fallback must be matched to a spine voter before it can be written here). */
export async function putOverlayRows(
  precinctKey: string,
  rows: Array<{ voterId: string; pp?: number; party?: string; source: string }>,
): Promise<number> {
  if (!dbConfigured || rows.length === 0) return 0;
  const now = new Date().toISOString();
  const items = rows
    .filter((r) => r.voterId)
    .map((r) => ({
      PK: PK.voterOverlay(precinctKey),
      SK: r.voterId,
      // Omit rather than default: an absent propensity is UNKNOWN, not zero, and
      // an absent party is not "other". Writing a default here would let a
      // targeting filter sweep up people it should never reach.
      ...(r.pp !== undefined ? { pp: r.pp } : {}),
      ...(r.party ? { party: r.party } : {}),
      source: r.source,
      importedAt: now,
    }));
  await batchWritePut(items);
  return items.length;
}

/** All overlay rows for one precinct, keyed by Voter ID. Returns an empty map
 *  when no overlay source has been ingested — callers then simply see no
 *  overlay-derived attributes, which is the correct pre-ingest behavior. */
export async function overlayByPrecinct(precinctKey: string): Promise<Map<string, VoterOverlay>> {
  const out = new Map<string, VoterOverlay>();
  if (!dbConfigured || !TABLE) return out;
  const rows = await queryAllPages({
    TableName: TABLE,
    KeyConditionExpression: "PK = :p",
    ExpressionAttributeValues: { ":p": PK.voterOverlay(precinctKey) },
  });
  for (const r of rows) {
    const o = toVoterOverlay(r as Record<string, unknown>);
    if (o) out.set(o.voterId, o);
  }
  return out;
}
