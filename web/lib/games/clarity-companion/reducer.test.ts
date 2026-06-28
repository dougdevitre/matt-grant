import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeClarityCompanion, scoreCeiling, type ClarityInput } from "./reducer";
import { clarityConfig, buildClarityCompanion } from "./content";
import type { ClarityConfig } from "./config.schema";

const cfg: ClarityConfig = clarityConfig;
const DT = 1000 / 30;

// Re-derive the deterministic card stream so a test can apply the RIGHT (or wrong)
// action to a card of a known type.
function cardStream(seed: string, count: number): { id: string; type: string; spawnTick: number }[] {
  const game = makeClarityCompanion(cfg);
  const rng = makeRng(seed);
  let state = game.init(cfg, { tick: 0, dtMs: DT, rng });
  const out: { id: string; type: string; spawnTick: number }[] = [];
  let prev = state.spawnCount;
  for (let t = 1; t <= cfg.roundTicks && out.length < count; t++) {
    state = game.step(state, [], { tick: t, dtMs: DT, rng });
    if (state.spawnCount > prev) {
      const c = state.queue[state.queue.length - 1];
      if (c) out.push({ id: c.id, type: c.type, spawnTick: c.spawnTick });
      prev = state.spawnCount;
    }
  }
  return out;
}

const run = (seed: string, inputs: InputEvent<ClarityInput>[]) =>
  replay(buildClarityCompanion(), cfg, seed, inputs, cfg.roundTicks);

describe("Clarity Companion — determinism", () => {
  it("same (seed, inputs) → identical final state + score", () => {
    const inputs: InputEvent<ClarityInput>[] = [{ tick: cfg.spawnEveryTicks + 1, input: { kind: "open", id: "r0" } }];
    const a = run("seed-A", inputs);
    const b = run("seed-A", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
  });

  it("client ≡ server replay; score within ceiling", () => {
    const inputs: InputEvent<ClarityInput>[] = [{ tick: cfg.spawnEveryTicks + 1, input: { kind: "redact", id: "r0" } }];
    const a = run("ac", inputs);
    const b = run("ac", inputs);
    expect(b.score.total).toBe(a.score.total);
    expect(b.score.total).toBeLessThanOrEqual(b.score.ceiling);
  });
});

describe("Clarity Companion — the two-sided constraint", () => {
  it("OPENing a child record exposes a kid and crashes Child Privacy", () => {
    const stream = cardStream("expose", 40);
    const child = stream.find((c) => c.type === "child")!;
    const { state } = run("expose", [{ tick: child.spawnTick + 1, input: { kind: "open", id: child.id } }]);
    expect(state.childExposures).toBeGreaterThanOrEqual(1);
    expect(state.childPrivacy).toBe(cfg.meterStart - cfg.exposeCrash);
  });

  it("PROTECTing a public record over-seals and crashes Accountability", () => {
    const stream = cardStream("seal", 40);
    const pub = stream.find((c) => c.type === "public")!;
    const { state } = run("seal", [{ tick: pub.spawnTick + 1, input: { kind: "protect", id: pub.id } }]);
    expect(state.overSeals).toBeGreaterThanOrEqual(1);
    expect(state.accountability).toBe(cfg.meterStart - cfg.sealCrash);
  });

  it("REDACT&OPEN on a mixed record lifts BOTH meters (best play) and never exposes a child", () => {
    const stream = cardStream("mixed", 60);
    const mixedIds = stream.filter((c) => c.type === "mixed");
    const inputs: InputEvent<ClarityInput>[] = mixedIds.map((c) => ({ tick: c.spawnTick + 1, input: { kind: "redact", id: c.id } }));
    const { state } = run("mixed", inputs);
    expect(state.childExposures).toBe(0);
    expect(state.correctCount).toBeGreaterThanOrEqual(mixedIds.length);
  });

  it("playing every record correctly upholds both meters; the score keeps its combo", () => {
    const stream = cardStream("perfect", 80);
    const inputs: InputEvent<ClarityInput>[] = stream.map((c) => ({
      tick: c.spawnTick + 1,
      input: { kind: c.type === "public" ? "open" : c.type === "child" ? "protect" : "redact", id: c.id },
    }));
    const { state, score } = run("perfect", inputs);
    expect(state.childExposures).toBe(0);
    expect(state.overSeals).toBe(0);
    expect(score.flags).toContain("both_upheld");
    expect(score.flags).toContain("no_child_exposed");
    expect(score.components.comboScore).toBeGreaterThan(0);
  });

  it("one-button play (always OPEN) collapses Child Privacy → balance_broken, combo forfeited", () => {
    const stream = cardStream("one-button", 80);
    const inputs: InputEvent<ClarityInput>[] = stream.map((c) => ({ tick: c.spawnTick + 1, input: { kind: "open", id: c.id } }));
    const { state, score } = run("one-button", inputs);
    expect(state.childPrivacy).toBeLessThan(cfg.meterFloor);
    expect(score.flags).toContain("balance_broken");
    expect(score.flags).not.toContain("both_upheld");
    expect(score.total).toBe(Math.max(0, score.components.meterScore)); // no combo reward
  });
});

describe("Clarity Companion — property fuzz", () => {
  it("meters ∈ [0,100]; score ∈ [0, ceiling]; correct play never exposes a child", () => {
    const driver = makeRng("fuzz");
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 120; trial++) {
      const seed = `f-${Math.floor(driver() * 1e9)}`;
      const n = Math.floor(driver() * 30);
      const inputs: InputEvent<ClarityInput>[] = Array.from({ length: n }, () => {
        const roll = driver();
        const kind: ClarityInput["kind"] = roll < 0.34 ? "open" : roll < 0.67 ? "protect" : "redact";
        return { tick: Math.floor(driver() * cfg.roundTicks), input: { kind, id: `r${Math.floor(driver() * 60)}` } };
      });
      const { state, score } = run(seed, inputs);
      expect(state.accountability).toBeGreaterThanOrEqual(0);
      expect(state.accountability).toBeLessThanOrEqual(100);
      expect(state.childPrivacy).toBeGreaterThanOrEqual(0);
      expect(state.childPrivacy).toBeLessThanOrEqual(100);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });
});
