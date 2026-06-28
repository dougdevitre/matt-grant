import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeRotation, effectiveness, seatStatus, scoreCeiling, type RotationInput } from "./reducer";
import { rotationConfig, buildRotation } from "./content";
import type { RotationConfig } from "./config.schema";

const cfg: RotationConfig = rotationConfig;
const DT = 1000 / 30;
const rampEnd = cfg.capTicks - cfg.windowDelta;

const run = (seed: string, inputs: InputEvent<RotationInput>[]) =>
  replay(buildRotation(), cfg, seed, inputs, cfg.roundTicks);

// Snapshot each seat's serviceTicks at the start of every tick by re-simulating with
// no inputs — lets a test rotate a seat exactly when it is in its window.
function seatAgesAt(seed: string, targetTick: number): { id: string; serviceTicks: number; grandfathered: boolean }[] {
  const game = makeRotation(cfg);
  const rng = makeRng(seed);
  let state = game.init(cfg, { tick: 0, dtMs: DT, rng });
  for (let t = 1; t <= targetTick; t++) state = game.step(state, [], { tick: t, dtMs: DT, rng });
  return state.seats.map((s) => ({ id: s.id, serviceTicks: s.serviceTicks, grandfathered: s.grandfathered }));
}

describe("Rotation — effectiveness curve", () => {
  it("ramps from 0 to peak, plateaus through the window, then decays", () => {
    expect(effectiveness(0, cfg)).toBe(0);
    expect(effectiveness(rampEnd, cfg)).toBe(cfg.peakEffectiveness); // window opens at peak
    expect(effectiveness(cfg.capTicks, cfg)).toBe(cfg.peakEffectiveness); // still peak at the cap
    expect(effectiveness(Math.floor(rampEnd / 2), cfg)).toBeLessThan(cfg.peakEffectiveness); // mid-ramp
    expect(effectiveness(cfg.capTicks + 50, cfg)).toBeLessThan(cfg.peakEffectiveness); // decaying
  });

  it("status reads ramping → ready → entrenched across the cap", () => {
    expect(seatStatus(rampEnd - 1, cfg)).toBe("ramping");
    expect(seatStatus(rampEnd, cfg)).toBe("ready");
    expect(seatStatus(cfg.capTicks, cfg)).toBe("ready");
    expect(seatStatus(cfg.capTicks + 1, cfg)).toBe("entrenched");
  });
});

describe("Rotation — determinism", () => {
  it("same (seed, inputs) → identical final state + score", () => {
    const inputs: InputEvent<RotationInput>[] = [{ tick: 200, input: { kind: "rotate", seatId: "s0" } }];
    const a = run("seed-A", inputs);
    const b = run("seed-A", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
  });

  it("client ≡ server replay; score within ceiling", () => {
    const inputs: InputEvent<RotationInput>[] = [
      { tick: 200, input: { kind: "rotate", seatId: "s2" } },
      { tick: 400, input: { kind: "rotate", seatId: "s3" } },
    ];
    const a = run("anti-cheat", inputs);
    const b = run("anti-cheat", inputs);
    expect(b.score.total).toBe(a.score.total);
    expect(b.score.total).toBeLessThanOrEqual(b.score.ceiling);
  });
});

describe("Rotation — the lesson (two-sided fail)", () => {
  it("rotating exactly in-window never yields the careerism flag (spec invariant)", () => {
    // Rotate one non-grandfathered seat the moment it enters the window.
    const seed = "in-window";
    // find a non-grandfathered seat and the tick it reaches rampEnd
    const start = seatAgesAt(seed, 0).find((s) => !s.grandfathered)!;
    const ticksToWindow = rampEnd - start.serviceTicks; // could be negative if it starts past rampEnd
    const fireTick = ticksToWindow > 0 ? ticksToWindow : 1;
    const { state, score } = run(seed, [{ tick: fireTick, input: { kind: "rotate", seatId: start.id } }]);
    expect(state.lateRotations).toBe(0);
    expect(score.flags).toContain("no_careerism");
  });

  it("rotating immediately (mid-ramp) books a churn penalty", () => {
    // Pick a seat that starts well before the window so an early rotate is genuinely early.
    const seed = "early";
    const fresh = seatAgesAt(seed, 1).find((s) => !s.grandfathered && s.serviceTicks < rampEnd - 5);
    expect(fresh).toBeDefined();
    const { state } = run(seed, [{ tick: 1, input: { kind: "rotate", seatId: fresh!.id } }]);
    expect(state.earlyRotations).toBeGreaterThanOrEqual(1);
    expect(state.churnTotal).toBeGreaterThan(0);
  });

  it("rotating an entrenched seat (past the cap) books careerism + a penalty", () => {
    const seed = "late";
    const seat = seatAgesAt(seed, 0).find((s) => !s.grandfathered)!;
    // wait until it is well past the cap, then rotate
    const fireTick = cfg.capTicks - seat.serviceTicks + 30;
    const { state, score } = run(seed, [{ tick: Math.max(1, fireTick), input: { kind: "rotate", seatId: seat.id } }]);
    expect(state.lateRotations).toBeGreaterThanOrEqual(1);
    expect(state.entrenchTotal).toBeGreaterThan(0);
    expect(score.flags).not.toContain("no_careerism");
  });

  it("grandfathered incumbents expire naturally and are exempt from the early penalty", () => {
    const seed = "grandfather";
    const gf = seatAgesAt(seed, 0).find((s) => s.grandfathered);
    expect(gf).toBeDefined();
    // Rotating a grandfathered seat immediately must NOT count as churn (exempt).
    const { state } = run(seed, [{ tick: 1, input: { kind: "rotate", seatId: gf!.id } }]);
    // s0..s{gfCount-1} are grandfathered; an exempt early rotate adds no churn from THIS seat.
    expect(state.churnTotal).toBe(0);
  });
});

describe("Rotation — property fuzz", () => {
  it("captured ≥ 0; penalties ≥ 0; score ∈ [0, ceiling] for any seed/inputs", () => {
    const driver = makeRng("fuzz");
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 120; trial++) {
      const seed = `f-${Math.floor(driver() * 1e9)}`;
      const n = Math.floor(driver() * 25);
      const inputs: InputEvent<RotationInput>[] = Array.from({ length: n }, () => ({
        tick: Math.floor(driver() * cfg.roundTicks),
        input: { kind: "rotate" as const, seatId: `s${Math.floor(driver() * cfg.seatCount)}` },
      }));
      const { state, score } = run(seed, inputs);
      expect(state.captured).toBeGreaterThanOrEqual(0);
      expect(state.churnTotal).toBeGreaterThanOrEqual(0);
      expect(state.entrenchTotal).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });
});
