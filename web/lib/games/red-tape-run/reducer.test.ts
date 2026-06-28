import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeRedTapeRun, scoreCeiling, type RedTapeRunInput } from "./reducer";
import { redTapeRunConfig, buildRedTapeRun } from "./content";
import type { RedTapeRunConfig } from "./config.schema";

const cfg: RedTapeRunConfig = redTapeRunConfig;
const DT = 1000 / 30;

const run = (seed: string, inputs: InputEvent<RedTapeRunInput>[]) =>
  replay(buildRedTapeRun(), cfg, seed, inputs, cfg.roundTicks);

const jumpEveryTick = (n: number): InputEvent<RedTapeRunInput>[] =>
  Array.from({ length: n }, (_, t) => ({ tick: t, input: { kind: "jump" as const } }));

describe("Red Tape Run — physics", () => {
  it("a single jump arcs above the clear height then lands", () => {
    const game = makeRedTapeRun(cfg);
    const rng = makeRng("phys");
    let s = game.init(cfg, { tick: 0, dtMs: DT, rng });
    s = game.step(s, [{ kind: "jump" }], { tick: 1, dtMs: DT, rng }); // launch
    let peak = s.y;
    let landed = false;
    for (let t = 2; t < 60; t++) {
      s = game.step(s, [], { tick: t, dtMs: DT, rng });
      peak = Math.max(peak, s.y);
      if (s.grounded && s.y === 0 && t > 3) {
        landed = true;
        break;
      }
    }
    expect(peak).toBeGreaterThanOrEqual(cfg.clearHeight); // clears abuses at the top of the arc
    expect(landed).toBe(true); // comes back down (so you can grab grounded reforms)
  });

  it("you cannot double-jump (a jump while airborne is ignored)", () => {
    const game = makeRedTapeRun(cfg);
    const rng = makeRng("dj");
    let s = game.init(cfg, { tick: 0, dtMs: DT, rng });
    s = game.step(s, [{ kind: "jump" }], { tick: 1, dtMs: DT, rng });
    const vyAfterFirst = s.vy;
    s = game.step(s, [{ kind: "jump" }], { tick: 2, dtMs: DT, rng }); // ignored mid-air
    expect(s.vy).toBeLessThan(vyAfterFirst); // still just decelerating, not re-launched
  });
});

describe("Red Tape Run — determinism", () => {
  it("same (seed, inputs) → identical final state + score", () => {
    const inputs = jumpEveryTick(20);
    const a = run("seed-A", inputs);
    const b = run("seed-A", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
  });

  it("client ≡ server replay; score within ceiling", () => {
    const inputs: InputEvent<RedTapeRunInput>[] = [
      { tick: 10, input: { kind: "jump" } },
      { tick: 40, input: { kind: "jump" } },
    ];
    const a = run("anti-cheat", inputs);
    const b = run("anti-cheat", inputs);
    expect(b.score.total).toBe(a.score.total);
    expect(b.score.total).toBeLessThanOrEqual(b.score.ceiling);
  });
});

describe("Red Tape Run — the two-sided lesson", () => {
  it("never jumping: grabs every reform it reaches but takes the abuse hits (never clears one)", () => {
    const { state } = run("idle", []);
    expect(state.abusesCleared).toBe(0); // never airborne → never clears an abuse
    expect(state.abusesHit).toBeGreaterThan(0); // runs into them on the ground
    expect(state.reformsMissed).toBe(0); // grounded the whole time → grabs every reform reached
  });

  it("never jumping eventually depletes integrity (the abuses grind you down)", () => {
    const { state } = run("grind", []);
    // hitDamage * abusesHit should drive integrity to the floor for any abuse-bearing seed
    expect(state.integrity).toBeLessThanOrEqual(cfg.integrityStart - cfg.hitDamage);
  });

  it("jumping trades reform-collection for abuse-clearing — you can't do both at once", () => {
    const idle = run("compare", []);
    const spam = run("compare", jumpEveryTick(cfg.roundTicks));
    // Airborne play clears abuses AND flies over reforms...
    expect(spam.state.abusesCleared).toBeGreaterThan(0);
    expect(spam.state.reformsMissed).toBeGreaterThan(0);
    // ...while grounded play does the opposite: clears no abuse, misses no reform it reaches.
    expect(idle.state.abusesCleared).toBe(0);
    expect(idle.state.reformsMissed).toBe(0);
  });
});

describe("Red Tape Run — property fuzz (any seed/inputs)", () => {
  it("integrity ∈ [0,start]; y ≥ 0; score ∈ [0, ceiling]; grounded ⇒ y==0", () => {
    const driver = makeRng("fuzz");
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 100; trial++) {
      const seed = `f-${Math.floor(driver() * 1e9)}`;
      const n = Math.floor(driver() * 200);
      const inputs: InputEvent<RedTapeRunInput>[] = Array.from({ length: n }, () => ({
        tick: Math.floor(driver() * cfg.roundTicks),
        input: { kind: "jump" as const },
      }));
      const { state, score } = run(seed, inputs);
      expect(state.integrity).toBeGreaterThanOrEqual(0);
      expect(state.integrity).toBeLessThanOrEqual(cfg.integrityStart);
      expect(state.y).toBeGreaterThanOrEqual(0);
      if (state.grounded) expect(state.y).toBe(0);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });
});
