import { replay, type InputEvent, type ScoreBreakdown } from "@/lib/games/engine";
import { buildCutAndSave, cutSaveConfig, type CutSaveInput } from "@/lib/games/cut-and-save";
import { buildOrgChart, orgChartConfig, type OrgChartInput } from "@/lib/games/org-chart";
import { buildRotation, rotationConfig, type RotationInput } from "@/lib/games/rotation";
import { buildClarityCompanion, clarityConfig, type ClarityInput } from "@/lib/games/clarity-companion";
import { buildRedTapeRun, redTapeRunConfig, type RedTapeRunInput } from "@/lib/games/red-tape-run";
import { buildTheDocket, docketConfig, type DocketInput } from "@/lib/games/the-docket";

// Server-side score validation = the SAME replay() the client ran, re-run from
// (seed, inputs). If the recomputed total doesn't match what the client reported
// (within EPS), the submission is a tampered/false score and is rejected. The
// recomputed score is clamped to the game's ScoreBreakdown.ceiling as a backstop.
//
// One validator per game id. Adding a game = add its build here; everything else
// (route, store, leaderboard) is generic.

export const SCORE_EPS = 1; // integer scores; allow no real slack

type Validator = (seed: string, inputs: InputEvent<unknown>[]) => ScoreBreakdown;

const VALIDATORS: Record<string, Validator> = {
  "cut-and-save": (seed, inputs) =>
    replay(
      buildCutAndSave(),
      cutSaveConfig,
      seed,
      inputs as InputEvent<CutSaveInput>[],
      cutSaveConfig.roundTicks,
    ).score,
  "org-chart": (seed, inputs) =>
    replay(
      buildOrgChart(),
      orgChartConfig,
      seed,
      inputs as InputEvent<OrgChartInput>[],
      orgChartConfig.roundTicks,
    ).score,
  "rotation": (seed, inputs) =>
    replay(
      buildRotation(),
      rotationConfig,
      seed,
      inputs as InputEvent<RotationInput>[],
      rotationConfig.roundTicks,
    ).score,
  "clarity-companion": (seed, inputs) =>
    replay(
      buildClarityCompanion(),
      clarityConfig,
      seed,
      inputs as InputEvent<ClarityInput>[],
      clarityConfig.roundTicks,
    ).score,
  "red-tape-run": (seed, inputs) =>
    replay(
      buildRedTapeRun(),
      redTapeRunConfig,
      seed,
      inputs as InputEvent<RedTapeRunInput>[],
      redTapeRunConfig.roundTicks,
    ).score,
  "the-docket": (seed, inputs) =>
    replay(
      buildTheDocket(),
      docketConfig,
      seed,
      inputs as InputEvent<DocketInput>[],
      docketConfig.roundTicks,
    ).score,
};

export interface ValidationResult {
  ok: boolean;
  recomputed: number;
  ceiling: number;
  flags: string[];
  reason?: "unknown_game" | "replay_mismatch";
}

export function validateScore(
  gameId: string,
  seed: string,
  inputs: InputEvent<unknown>[],
  reportedScore: number,
): ValidationResult {
  const validator = VALIDATORS[gameId];
  if (!validator) return { ok: false, recomputed: 0, ceiling: 0, flags: [], reason: "unknown_game" };

  const breakdown = validator(seed, inputs);
  const recomputed = Math.min(breakdown.total, breakdown.ceiling); // ceiling clamp
  if (Math.abs(recomputed - reportedScore) > SCORE_EPS) {
    return { ok: false, recomputed, ceiling: breakdown.ceiling, flags: breakdown.flags, reason: "replay_mismatch" };
  }
  return { ok: true, recomputed, ceiling: breakdown.ceiling, flags: breakdown.flags };
}
