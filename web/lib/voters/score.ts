// The voter scorecard — pure, tested, and the SINGLE place segment definitions
// live so the dashboard, exports, and docs can't drift (candidate/
// voter-file-plan.md §4). Honest by design: T comes from real participation
// recency (the only participation signal the file carries — most recent
// election ONLY); S is a labeled PROXY until canvass IDs are written back in
// Phase 5. No model is fitted before labels exist.

import type { LastVoted, VoterRecord } from "./parse";

/**
 * Turnout propensity T (0-5), keyed on RECENCY of the voter's most recent
 * recorded election (the file has no frequency data):
 *   5  latest vote is a 2025-26 election (municipal/special/primary — the
 *      habitual-voter proxy: off-cycle voters are the most reliable)
 *   4  2024 (the last federal general)
 *   3  2020-2023
 *   2  anything older
 *   1  registered, no recorded participation
 *   0  Inactive status (overrides everything)
 */
export function turnoutScore(lastVoted: LastVoted, active: boolean): number {
  if (!active) return 0;
  if (!lastVoted) return 1;
  if (lastVoted.year >= 2025) return 5;
  if (lastVoted.year === 2024) return 4;
  if (lastVoted.year >= 2020) return 3;
  return 2;
}

/** Registered after the 2024 general — the motivated new-registrant cohort. */
export function isNewRegistrant(regDate: string | null): boolean {
  return !!regDate && regDate >= "2024-11-06";
}

/**
 * Support proxy S (0-3). Party is blank for ~90% of MO-02 rows, so this is
 * explicitly a PROXY (labeled as such in every UI/export): explicit party
 * where present, the neutral middle otherwise. A precinct-level prior joins in
 * Phase 3; real canvass IDs replace it per-voter in Phase 5.
 *   3 Republican · 2 Libertarian/Constitution (R-primary-adjacent)
 *   1 blank/Unaffiliated/other (unknown) · 0 Democratic
 */
export function supportProxy(party?: string): number {
  const p = (party ?? "").trim().toLowerCase();
  if (!p || p === "unaffiliated") return 1;
  if (p.startsWith("rep")) return 3;
  if (p.startsWith("lib") || p.startsWith("cons")) return 2;
  if (p.startsWith("dem")) return 0;
  return 1;
}

/**
 * Canvass ID (walk.ts CANVASS_ID_KEY: 1 Strong Grant · 2 Lean Grant ·
 * 3 Undecided · 4 Lean other · 5 Strong other) → S. The Phase-5 write-back:
 * a real ID REPLACES the party proxy on the voter row. Both "other" leans map
 * to 0 — an identified opponent is do-not-chase (tactics/ballot-chase-program.md).
 */
export function sFromCanvassId(id: number): number {
  if (id === 1) return 3;
  if (id === 2) return 2;
  if (id === 3) return 1;
  return 0; // 4 or 5
}

// The targeting matrix (workflows/voter-targeting.md), one tested function:
//   BANK     S≥2, T≥4 — reliable supporters: light touch, ballot chase
//   MOBILIZE S≥2, T 1-3 — supporters who need the turnout push (GOTV core)
//   PERSUADE S=1, T≥4 — habitual voters, unknown lean (doors/mail persuasion)
//   PROSPECT S=1, T 1-3 — unknown + unlikely: lit drops only, no budget
//   MONITOR  S=0 or T=0 — opposition or inactive: no contact budget
export const SEGMENTS = ["BANK", "MOBILIZE", "PERSUADE", "PROSPECT", "MONITOR"] as const;
export type Segment = (typeof SEGMENTS)[number];

export function segmentFor(t: number, s: number): Segment {
  if (t === 0 || s === 0) return "MONITOR";
  if (s >= 2) return t >= 4 ? "BANK" : "MOBILIZE";
  return t >= 4 ? "PERSUADE" : "PROSPECT";
}

export type ScoredVoter = VoterRecord & {
  t: number;
  s: number;
  segment: Segment;
  newRegistrant: boolean;
};

export function scoreVoter(v: VoterRecord): ScoredVoter {
  const t = turnoutScore(v.lastVoted, v.active);
  const s = supportProxy(v.party);
  return { ...v, t, s, segment: segmentFor(t, s), newRegistrant: isNewRegistrant(v.regDate) };
}
