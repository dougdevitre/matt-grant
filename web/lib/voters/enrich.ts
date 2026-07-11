// Voter-file enrichment for the precinct surfaces (voter-file-plan.md Phase 3):
// turns VOTERAGG rollups into a per-precinct primary-propensity score and
// universe counts, joined to map/Targets precinct NAMES via the crosswalk.
// Pure and client-safe. HEURISTIC, labeled as such everywhere it renders: the
// weights below are a transparent recency scorecard (the file carries only each
// voter's most recent election), not a fitted model — Phase 5's canvass labels
// are what eventually earn a real one.
import { buildCrosswalk, normalizePrecinct } from "./crosswalk";
import type { BallotAggRow } from "./chase";
import type { VoterAggRow } from "./storeTypes";

// P(votes in the Aug 2026 primary | T score) — heuristic recency weights.
// T5 = latest vote was a 2025-26 off-cycle election (habitual off-cycle voters
// are near-certain primary voters) … T0 = Inactive.
export const PRIMARY_WEIGHTS = [0.02, 0.1, 0.2, 0.35, 0.6, 0.9] as const;

export type PrecinctEnrichment = {
  count: number;
  expectedPrimary: number; // heuristic expected primary voters
  vPropensity: number; // expectedPrimary / count, 0..1
  persuade: number;
  mobilize: number;
  bank: number;
  banked: number; // ballots already returned (chase imports); 0 pre-returns
};

export function precinctEnrichment(a: VoterAggRow): PrecinctEnrichment {
  const expected = a.t.reduce((sum, n, i) => sum + n * (PRIMARY_WEIGHTS[i] ?? 0), 0);
  return {
    count: a.count,
    expectedPrimary: Math.round(expected),
    vPropensity: a.count ? Math.min(1, expected / a.count) : 0,
    persuade: a.seg.PERSUADE ?? 0,
    mobilize: a.seg.MOBILIZE ?? 0,
    bank: a.seg.BANK ?? 0,
    banked: 0, // joined from BALLOTAGG in enrichmentByMapName
  };
}

export type EnrichmentJoin = {
  byName: Map<string, PrecinctEnrichment>; // canonical map/Targets precinct name → enrichment
  hitRate: number; // over distinct voter-file precinct labels
  misses: string[];
};

/**
 * Join aggregates onto the map/Targets precinct names. Aggregate keys are
 * "county#precinct" (normalized); matching runs through the same crosswalk the
 * ingest reports on — unmatched labels are returned, never silently dropped.
 * Multiple aggregate rows matching one map name (split precincts) are summed.
 */
export function enrichmentByMapName(
  aggs: VoterAggRow[],
  mapNames: string[],
  ballotAggs: BallotAggRow[] = [],
): EnrichmentJoin {
  const labels = aggs.map((a) => a.precinctKey.split("#")[1] ?? "");
  const { matched, misses, hitRate } = buildCrosswalk(labels, mapNames);
  const bankedByKey = new Map(ballotAggs.map((b) => [b.precinctKey, b.banked]));
  const byName = new Map<string, PrecinctEnrichment>();
  for (const a of aggs) {
    const label = normalizePrecinct(a.precinctKey.split("#")[1] ?? "");
    const mapName = matched.get(label);
    if (!mapName) continue;
    const e = { ...precinctEnrichment(a), banked: bankedByKey.get(a.precinctKey) ?? 0 };
    const prev = byName.get(mapName);
    byName.set(
      mapName,
      prev
        ? {
            count: prev.count + e.count,
            expectedPrimary: prev.expectedPrimary + e.expectedPrimary,
            vPropensity: 0, // recomputed below from summed parts
            persuade: prev.persuade + e.persuade,
            mobilize: prev.mobilize + e.mobilize,
            bank: prev.bank + e.bank,
            banked: prev.banked + e.banked,
          }
        : e,
    );
  }
  for (const [k, e] of byName) {
    byName.set(k, { ...e, vPropensity: e.count ? Math.min(1, e.expectedPrimary / e.count) : 0 });
  }
  return { byName, hitRate, misses };
}

/**
 * Normalized precinct label → heuristic primary propensity (0..1), for free-text
 * precinct lookups (the Signs tool's CSV `precinct` column). Labels shared across
 * counties (split precincts too) are summed before the ratio — never averaged.
 */
export function propensityByPrecinctLabel(aggs: VoterAggRow[]): Record<string, number> {
  const sums = new Map<string, { count: number; expected: number }>();
  for (const a of aggs) {
    const label = normalizePrecinct(a.precinctKey.split("#")[1] ?? "");
    if (!label) continue;
    const e = precinctEnrichment(a);
    const prev = sums.get(label) ?? { count: 0, expected: 0 };
    sums.set(label, { count: prev.count + e.count, expected: prev.expected + e.expectedPrimary });
  }
  const out: Record<string, number> = {};
  for (const [label, s] of sums) out[label] = s.count ? Math.min(1, s.expected / s.count) : 0;
  return out;
}

/**
 * Autofill a missing `propensity` from the precinct lookup above. An explicit
 * propensity (CSV-provided) ALWAYS wins — this only fills blanks, so a staffer's
 * judgment is never silently overwritten. Rows without a matching precinct are
 * returned untouched (the scorer's neutral default applies downstream).
 */
export function fillPropensity<T extends { precinct?: string; propensity?: number }>(
  rows: T[],
  lookup: Record<string, number>,
): T[] {
  return rows.map((r) => {
    if (typeof r.propensity === "number" || !r.precinct) return r;
    const p = lookup[normalizePrecinct(r.precinct)];
    return typeof p === "number" ? { ...r, propensity: p } : r;
  });
}
