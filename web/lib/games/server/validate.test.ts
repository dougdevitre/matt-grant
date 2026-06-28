import { describe, it, expect } from "vitest";
import { replay, type InputEvent } from "@/lib/games/engine";
import { buildCutAndSave, cutSaveConfig, type CutSaveInput } from "@/lib/games/cut-and-save";
import { validateScore } from "./validate";

// The score API's anti-cheat core, tested directly (the route is a thin wrapper:
// rate-limit → flags → validateScore → store). A valid (seed, inputs) → reportedScore
// is accepted; a tampered reportedScore for the same play is rejected.

const seed = "validate-seed";
const inputs: InputEvent<CutSaveInput>[] = [
  { tick: 18, input: { kind: "cut", id: "i0" } },
  { tick: 54, input: { kind: "cut", id: "i2" } },
];
const honest = replay(buildCutAndSave(), cutSaveConfig, seed, inputs, cutSaveConfig.roundTicks).score.total;

describe("validateScore", () => {
  it("accepts a score the server can reproduce from (seed, inputs)", () => {
    const r = validateScore("cut-and-save", seed, inputs, honest);
    expect(r.ok).toBe(true);
    expect(r.recomputed).toBe(honest);
    expect(r.recomputed).toBeLessThanOrEqual(r.ceiling);
  });

  it("rejects a tampered reportedScore (replay_mismatch)", () => {
    const r = validateScore("cut-and-save", seed, inputs, honest + 100000);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("replay_mismatch");
  });

  it("rejects an unknown game", () => {
    const r = validateScore("not-a-game", seed, inputs, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown_game");
  });

  it("clamps an absurd reported score to the ceiling (can't beat the max)", () => {
    // Even a 'correct' replay can't report above the ceiling; the recomputed value is
    // clamped, so a moon-shot reportedScore fails the equality check.
    const r = validateScore("cut-and-save", seed, inputs, 10 ** 11);
    expect(r.ok).toBe(false);
  });
});
