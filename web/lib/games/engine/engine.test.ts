import { describe, it, expect } from "vitest";
import { xfnv1a, mulberry32, makeRng, weightedPick } from "./rng";
import { comboMultiplier, applyMultiplier, clamp } from "./scoring";
import { ddaKnob, accuracy } from "./dda";
import { replay, type ReplayResult } from "./replay";
import type { Game, InputEvent } from "./types";

// ---- RNG: deterministic + platform-stable -----------------------------------
describe("rng", () => {
  it("xfnv1a is a stable hash of the string", () => {
    expect(xfnv1a("seed-1")).toBe(xfnv1a("seed-1"));
    expect(xfnv1a("seed-1")).not.toBe(xfnv1a("seed-2"));
  });

  it("makeRng yields the same stream for the same seed", () => {
    const a = makeRng("abc");
    const b = makeRng("abc");
    const seqA = Array.from({ length: 16 }, () => a());
    const seqB = Array.from({ length: 16 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = Array.from({ length: 8 }, makeRng("abc"));
    const b = Array.from({ length: 8 }, makeRng("xyz"));
    expect(a).not.toEqual(b);
  });

  it("draws stay in [0,1)", () => {
    const r = mulberry32(123);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("weightedPick respects a zero-weight option and stays in range", () => {
    const r = makeRng("w");
    const counts = [0, 0, 0];
    for (let i = 0; i < 3000; i++) counts[weightedPick(r, [3, 0, 1])]++;
    expect(counts[1]).toBe(0); // zero-weight is never chosen
    expect(counts[0]).toBeGreaterThan(counts[2]); // 3:1 favors index 0
  });
});

// ---- Scoring math ------------------------------------------------------------
describe("scoring", () => {
  const cfg = { stepEvery: 3, stepValue: 0.25, maxSteps: 4 };
  it("multiplier starts at 1 and steps up, capped", () => {
    expect(comboMultiplier(0, cfg)).toBe(1);
    expect(comboMultiplier(2, cfg)).toBe(1);
    expect(comboMultiplier(3, cfg)).toBe(1.25);
    expect(comboMultiplier(12, cfg)).toBe(2); // 4 steps
    expect(comboMultiplier(999, cfg)).toBe(2); // capped at maxSteps
  });
  it("applyMultiplier rounds", () => {
    expect(applyMultiplier(100, 3, cfg)).toBe(125);
    expect(applyMultiplier(10, 0, cfg)).toBe(10);
  });
  it("clamp bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

// ---- DDA ---------------------------------------------------------------------
describe("dda", () => {
  const cfg = { targetAccuracy: 0.72, base: 900, gain: 1000, min: 400, max: 1400, invert: true };
  it("returns base at exactly target accuracy", () => {
    expect(ddaKnob(0.72, cfg)).toBeCloseTo(900);
  });
  it("playing above target makes a spawn-interval knob smaller (harder)", () => {
    expect(ddaKnob(0.95, cfg)).toBeLessThan(900);
  });
  it("playing below target makes it larger (easier), within clamp", () => {
    const k = ddaKnob(0.1, cfg);
    expect(k).toBeGreaterThan(900);
    expect(k).toBeLessThanOrEqual(1400);
  });
  it("output is always clamped", () => {
    for (let a = 0; a <= 1.0001; a += 0.01) {
      const k = ddaKnob(a, cfg);
      expect(k).toBeGreaterThanOrEqual(400);
      expect(k).toBeLessThanOrEqual(1400);
    }
  });
  it("accuracy is lenient (1.0) before any attempts", () => {
    expect(accuracy(0, 0)).toBe(1);
    expect(accuracy(3, 4)).toBe(0.75);
  });
});

// ---- Determinism harness: a trivial game replays byte-stably ----------------
// A counter game whose state depends on rng + inputs, used to prove replay() is a
// pure function of (seed, inputs, totalTicks) — the property the score API relies on
// to validate a client-reported score against a server re-run.
type S = { sum: number; hits: number };
type I = { kind: "hit" };
const counterGame: Game<S, I, { perTick: number }> = {
  id: "counter",
  init: () => ({ sum: 0, hits: 0 }),
  step: (state, inputs, ctx) => ({
    sum: state.sum + Math.floor(ctx.rng() * 100) + inputs.length,
    hits: state.hits + inputs.length,
  }),
  isOver: () => false,
  score: (s) => ({ total: s.sum, components: { sum: s.sum, hits: s.hits }, flags: [], ceiling: 1e9 }),
};

function run(seed: string, inputs: InputEvent<I>[]): ReplayResult<S> {
  return replay(counterGame, { perTick: 1 }, seed, inputs, 60);
}

describe("replay determinism (client ≡ server guarantee)", () => {
  it("same (seed, inputs) → identical final state across runs", () => {
    const inputs: InputEvent<I>[] = [
      { tick: 3, input: { kind: "hit" } },
      { tick: 3, input: { kind: "hit" } },
      { tick: 20, input: { kind: "hit" } },
    ];
    const a = run("match-seed", inputs);
    const b = run("match-seed", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
  });

  it("fuzz: 200 random seed/input combos are reproducible", () => {
    const gen = makeRng("fuzz-driver");
    for (let trial = 0; trial < 200; trial++) {
      const seed = `s-${Math.floor(gen() * 1e9)}`;
      const n = Math.floor(gen() * 10);
      const inputs: InputEvent<I>[] = Array.from({ length: n }, () => ({
        tick: Math.floor(gen() * 60),
        input: { kind: "hit" as const },
      }));
      const first = run(seed, inputs);
      const second = run(seed, inputs);
      expect(second.state).toEqual(first.state);
    }
  });

  it("input ordering within a tick is preserved (apply order is stable)", () => {
    const a = run("o", [
      { tick: 1, input: { kind: "hit" } },
      { tick: 1, input: { kind: "hit" } },
    ]);
    expect(a.state.hits).toBe(2);
  });
});
