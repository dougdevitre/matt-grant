// Per-precinct aggregation — extracted from the ingest script so the Phase-5
// canvass-ID write-back can RE-aggregate a precinct with the exact same math
// (voter-file-plan.md §3: dashboards read VOTERAGG only, so any voter-row
// change must move the rollup too). Pure and side-effect free.
import { ageBand } from "./parse";
import { SEGMENTS, type Segment } from "./score";
import { chaseTier, type ChaseTier } from "./chase";

export type VoterAgg = {
  count: number;
  active: number;
  t: number[]; // histogram 0-5
  seg: Record<string, number>;
  age: Record<string, number>;
  newReg: number;
  county: string;
  // Chase-tier universes (ballot-chase-program.md via chaseTier) — VOTERAGG's
  // seg counts can't split BANK by T4/T5, so the tier cross-count lives here.
  tiers: Record<ChaseTier, number>;
};

export const newAgg = (county: string): VoterAgg => ({
  count: 0,
  active: 0,
  t: [0, 0, 0, 0, 0, 0],
  seg: Object.fromEntries(SEGMENTS.map((s) => [s, 0])),
  age: {},
  newReg: 0,
  county,
  tiers: { "1": 0, "2": 0, "3": 0, "4": 0 },
});

/** The fields aggregation reads — satisfied by both ScoredVoter and StoredVoter. */
export type AggregatableVoter = {
  active: boolean;
  t: number;
  segment: Segment;
  yob: number | null;
  newRegistrant: boolean;
};

export function accumulate(agg: VoterAgg, v: AggregatableVoter): void {
  agg.count++;
  if (v.active) agg.active++;
  agg.t[v.t]++;
  agg.seg[v.segment] = (agg.seg[v.segment] ?? 0) + 1;
  const band = ageBand(v.yob);
  agg.age[band] = (agg.age[band] ?? 0) + 1;
  if (v.newRegistrant) agg.newReg++;
  const tier = chaseTier(v.segment, v.t);
  if (tier) agg.tiers[tier]++;
}

/** One precinct's rollup from its voter rows (the re-aggregation entry point). */
export function aggregateVoters(voters: AggregatableVoter[], county: string): VoterAgg {
  const agg = newAgg(county);
  for (const v of voters) accumulate(agg, v);
  return agg;
}
