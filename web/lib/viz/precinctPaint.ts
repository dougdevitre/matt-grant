// Paint expressions for the precinct-extrude layer's "color/extrude by" modes —
// pure JSON builders so the map's visual encoding is unit-testable without WebGL.
// RegionMap3D applies these via setPaintProperty (a paint swap on one layer; the
// init-once architecture never rebuilds the map on a mode change).
//
// Modes: turnout (Aug '24 %, the original view) · tier (A/B/C from lib/precincts
// scoreRows, "votes" strategy — matches /dashboard/targets exactly) · gotv
// (registered non-voters = mobilization upside). For tier/gotv, HEIGHT carries
// the ballot volume (expected/gotv) and COLOR carries the classification.

import type { ExpressionSpecification } from "maplibre-gl";
import { BRAND, TIER_COLOR, TURNOUT_RAMP, TURNOUT_LEGEND_GRADIENT } from "@/lib/viz/palette";

export type MapMode = "turnout" | "tier" | "gotv" | "voter" | "earlyVote";

export type ModeStats = { maxExpected: number; maxGotv: number; maxPersuade: number; maxBanked: number };

// Turnout mode's tallest column is ~40% × 130 = 5200; scale the other modes'
// tallest to a comparable ceiling so switching modes keeps a familiar skyline.
const HEIGHT_MAX = 4500;

const turnoutValue: ExpressionSpecification = ["coalesce", ["get", "turnout"], 0];

/** Max expected/gotv across the scored features — the data-derived scale for tier/gotv modes. */
export function modeStats(features: GeoJSON.Feature[]): ModeStats {
  let maxExpected = 0;
  let maxGotv = 0;
  let maxPersuade = 0;
  let maxBanked = 0;
  for (const f of features) {
    const p = (f.properties ?? {}) as { expected?: number; gotv?: number; persuade?: number; banked?: number };
    if (typeof p.expected === "number" && p.expected > maxExpected) maxExpected = p.expected;
    if (typeof p.gotv === "number" && p.gotv > maxGotv) maxGotv = p.gotv;
    if (typeof p.persuade === "number" && p.persuade > maxPersuade) maxPersuade = p.persuade;
    if (typeof p.banked === "number" && p.banked > maxBanked) maxBanked = p.banked;
  }
  return { maxExpected, maxGotv, maxPersuade, maxBanked };
}

/** fill-extrusion-color for the given mode. */
export function colorExpr(mode: MapMode, stats: ModeStats): ExpressionSpecification {
  if (mode === "earlyVote") {
    // Ballots returned as a share of the §4 heuristic expected primary vote —
    // where the early vote is pacing ahead (dark) vs behind (pale).
    return [
      "interpolate", ["linear"], ["coalesce", ["get", "bankedShare"], 0],
      0.05, TURNOUT_RAMP[0], 0.15, TURNOUT_RAMP[1], 0.3, TURNOUT_RAMP[2], 0.5, TURNOUT_RAMP[3],
    ];
  }
  if (mode === "voter") {
    // Heuristic primary propensity from the ingested voter file (0..1) —
    // voter-file-plan.md §4/Phase 3. Unmatched precincts coalesce to 0 (palest).
    return [
      "interpolate", ["linear"], ["coalesce", ["get", "vPropensity"], 0],
      0.1, TURNOUT_RAMP[0], 0.3, TURNOUT_RAMP[1], 0.5, TURNOUT_RAMP[2], 0.7, TURNOUT_RAMP[3],
    ];
  }
  if (mode === "tier") {
    return [
      "match",
      ["coalesce", ["get", "tier"], ""],
      "A", TIER_COLOR.A,
      "B", TIER_COLOR.B,
      "C", TIER_COLOR.C,
      BRAND.line, // unscored (no turnout data) — neutral, never mistaken for a tier
    ];
  }
  if (mode === "gotv") {
    const max = Math.max(1, stats.maxGotv);
    return [
      "interpolate", ["linear"], ["coalesce", ["get", "gotv"], 0],
      0, TURNOUT_RAMP[0],
      max / 3, TURNOUT_RAMP[1],
      (2 * max) / 3, TURNOUT_RAMP[2],
      max, TURNOUT_RAMP[3],
    ];
  }
  return [
    "interpolate", ["linear"], turnoutValue,
    8, TURNOUT_RAMP[0], 18, TURNOUT_RAMP[1], 28, TURNOUT_RAMP[2], 40, TURNOUT_RAMP[3],
  ];
}

/** fill-extrusion-height for the given mode. */
export function heightExpr(mode: MapMode, stats: ModeStats): ExpressionSpecification {
  if (mode === "earlyVote") {
    // Height = ballots in the bank; color carries the pace.
    return ["*", ["coalesce", ["get", "banked"], 0], HEIGHT_MAX / Math.max(1, stats.maxBanked)];
  }
  if (mode === "voter") {
    // Height = the PERSUADE universe (habitual voters, unknown lean) — where
    // doors and mail go; color carries the propensity shade.
    return ["*", ["coalesce", ["get", "persuade"], 0], HEIGHT_MAX / Math.max(1, stats.maxPersuade)];
  }
  if (mode === "tier") {
    // Height = expected ballots (what tiering ranks on) so tall = votes at stake.
    return ["*", ["coalesce", ["get", "expected"], 0], HEIGHT_MAX / Math.max(1, stats.maxExpected)];
  }
  if (mode === "gotv") {
    return ["*", ["coalesce", ["get", "gotv"], 0], HEIGHT_MAX / Math.max(1, stats.maxGotv)];
  }
  return ["*", turnoutValue, 130];
}

export type ModeLegend =
  | { kind: "gradient"; gradient: string; minLabel: string; maxLabel: string; note: string }
  | { kind: "swatches"; entries: { color: string; label: string }[]; note: string };

/** Legend spec kept in lockstep with the paint expressions above. */
export function legendFor(mode: MapMode, stats: ModeStats): ModeLegend {
  if (mode === "earlyVote") {
    return {
      kind: "gradient",
      gradient: TURNOUT_LEGEND_GRADIENT,
      minLabel: "~5%",
      maxLabel: "~50%+",
      note: "Shade = ballots returned as a share of the expected primary vote (heuristic denominator — voter-file-plan.md §4); height = ballots banked. Early voting Jul 21 - Aug 3; returns from the Ballot chase imports.",
    };
  }
  if (mode === "voter") {
    return {
      kind: "gradient",
      gradient: TURNOUT_LEGEND_GRADIENT,
      minLabel: "~10%",
      maxLabel: "~70%+",
      note: "Shade = heuristic primary propensity from the voter file; height = PERSUADE universe (habitual voters, unknown lean). Labeled heuristic — see voter-file-plan.md §4.",
    };
  }
  if (mode === "tier") {
    return {
      kind: "swatches",
      entries: [
        { color: TIER_COLOR.A, label: "Tier A — top 40% of expected ballots" },
        { color: TIER_COLOR.B, label: "Tier B — next 30%" },
        { color: TIER_COLOR.C, label: "Tier C — rest" },
      ],
      note: "Height = expected ballots (registered × Aug '24 turnout). Same ranking as the Targets page.",
    };
  }
  if (mode === "gotv") {
    return {
      kind: "gradient",
      gradient: TURNOUT_LEGEND_GRADIENT,
      minLabel: "0",
      maxLabel: stats.maxGotv > 0 ? `~${stats.maxGotv.toLocaleString()}` : "—",
      note: "Height + shade = registered voters who sat out Aug '24 (mobilization upside).",
    };
  }
  return {
    kind: "gradient",
    gradient: TURNOUT_LEGEND_GRADIENT,
    minLabel: "~8%",
    maxLabel: "~40%",
    note: "Taller & darker blue = higher Aug '24 primary turnout.",
  };
}
