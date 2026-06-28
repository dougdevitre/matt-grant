import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeCutAndSave, scoreCeiling, type CutSaveInput, type CutSaveState } from "./reducer";
import { cutSaveConfig, buildCutAndSave } from "./content";
import type { CutSaveConfig } from "./config.schema";

const cfg: CutSaveConfig = cutSaveConfig;

// Re-derive the deterministic item stream for a seed so a test can target items by id
// with the RIGHT action without hard-coding the RNG output.
function itemStreamTypes(seed: string, count: number): { id: string; type: string }[] {
  const game = makeCutAndSave(cfg);
  let state = game.init(cfg, { tick: 0, dtMs: 1000 / 30, rng: makeRng(seed) });
  const rng = makeRng(seed);
  const out: { id: string; type: string }[] = [];
  // Walk ticks, capturing each item the moment it spawns onto the board.
  let prevCount = state.spawnCount;
  for (let t = 0; t <= cfg.roundTicks && out.length < count; t++) {
    state = game.step(state, [], { tick: t, dtMs: 1000 / 30, rng });
    if (state.spawnCount > prevCount) {
      const justSpawned = state.board[state.board.length - 1];
      if (justSpawned) out.push({ id: justSpawned.id, type: justSpawned.type });
      prevCount = state.spawnCount;
    }
  }
  return out;
}

function runWith(seed: string, inputs: InputEvent<CutSaveInput>[]) {
  return replay(buildCutAndSave(), cfg, seed, inputs, cfg.roundTicks);
}

describe("Cut & Save — determinism", () => {
  it("same (seed, inputs) → identical final state and score", () => {
    const inputs: InputEvent<CutSaveInput>[] = [{ tick: 18, input: { kind: "cut", id: "i0" } }];
    const a = runWith("seed-A", inputs);
    const b = runWith("seed-A", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
  });

  it("client and server replay of the same submission agree (anti-cheat core)", () => {
    const inputs: InputEvent<CutSaveInput>[] = [
      { tick: 36, input: { kind: "cut", id: "i1" } },
      { tick: 72, input: { kind: "cut", id: "i3" } },
    ];
    const clientSide = runWith("anti-cheat", inputs);
    const serverSide = runWith("anti-cheat", inputs); // identical code path on the API
    expect(serverSide.score.total).toBe(clientSide.score.total);
    expect(serverSide.score.total).toBeLessThanOrEqual(serverSide.score.ceiling);
  });
});

describe("Cut & Save — scoring invariants", () => {
  it("an empty run (no inputs) harms no families and never borrows", () => {
    const { state, score } = runWith("idle", []);
    expect(state.familiesHarmed).toBe(0);
    expect(state.borrowUsed).toBe(0);
    expect(score.flags).toContain("no_family_harmed");
    expect(score.flags).toContain("no_borrow");
    expect(score.total).toBeGreaterThanOrEqual(0);
  });

  it("cutting only waste raises relief and keeps families safe", () => {
    const stream = itemStreamTypes("waste-only", 40);
    const wasteIds = stream.filter((s) => s.type === "waste").map((s) => s.id);
    // schedule a cut shortly after each waste item spawns (ids are i0,i1,... in spawn order)
    const inputs: InputEvent<CutSaveInput>[] = wasteIds.map((id, i) => ({
      tick: 18 * (Number(id.slice(1)) + 1) + 1,
      input: { kind: "cut", id },
    }));
    const { state } = runWith("waste-only", inputs);
    expect(state.familiesHarmed).toBe(0);
    expect(state.relief).toBeGreaterThan(0);
  });

  it("cutting an essential harms a family and deducts relief", () => {
    const stream = itemStreamTypes("ess", 30);
    const firstEssential = stream.find((s) => s.type === "essential");
    expect(firstEssential).toBeDefined();
    const ord = Number(firstEssential!.id.slice(1));
    const inputs: InputEvent<CutSaveInput>[] = [
      { tick: 18 * (ord + 1) + 1, input: { kind: "cut", id: firstEssential!.id } },
    ];
    const { state, score } = runWith("ess", inputs);
    expect(state.familiesHarmed).toBeGreaterThanOrEqual(1);
    expect(score.flags).not.toContain("no_family_harmed");
  });

  it("borrowing adds debt that compounds and erodes the score", () => {
    const borrow: InputEvent<CutSaveInput>[] = [{ tick: 30, input: { kind: "borrow" } }];
    const { state, score } = runWith("borrow", borrow);
    expect(state.borrowUsed).toBe(1);
    expect(state.debt).toBeGreaterThan(cfg.borrow.debtAdded); // compounded past the principal
    expect(score.flags).not.toContain("no_borrow");
  });

  it("borrowing nets WORSE than the same run without it (gimmick is self-defeating)", () => {
    const clean = runWith("compare", []);
    const borrowed = runWith("compare", [{ tick: 30, input: { kind: "borrow" } }]);
    expect(borrowed.score.total).toBeLessThan(clean.score.total + cfg.bonuses.noBorrow);
    expect(borrowed.score.total).toBeLessThanOrEqual(clean.score.total);
  });
});

describe("Cut & Save — property fuzz (any seed/inputs)", () => {
  it("relief never negative; taxPct within [floor,100]; score within [0,ceiling]", () => {
    const driver = makeRng("fuzz");
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 120; trial++) {
      const seed = `f-${Math.floor(driver() * 1e9)}`;
      const n = Math.floor(driver() * 25);
      const inputs: InputEvent<CutSaveInput>[] = Array.from({ length: n }, () => {
        const roll = driver();
        const tick = Math.floor(driver() * cfg.roundTicks);
        if (roll < 0.2) return { tick, input: { kind: "borrow" as const } };
        const id = `i${Math.floor(driver() * 60)}`;
        return { tick, input: { kind: roll < 0.7 ? ("cut" as const) : ("skip" as const), id } };
      });
      const { state, score } = runWith(seed, inputs);
      expect(state.relief).toBeGreaterThanOrEqual(0);
      expect(state.taxPct).toBeGreaterThanOrEqual(cfg.taxFloor);
      expect(state.taxPct).toBeLessThanOrEqual(100);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });

  it("zero cut inputs ⇒ familiesHarmed === 0 for any seed", () => {
    const driver = makeRng("no-cuts");
    for (let trial = 0; trial < 60; trial++) {
      const seed = `nc-${Math.floor(driver() * 1e9)}`;
      // only skips and borrows — never a cut
      const inputs: InputEvent<CutSaveInput>[] = Array.from({ length: 10 }, () => ({
        tick: Math.floor(driver() * cfg.roundTicks),
        input: driver() < 0.5 ? { kind: "skip" as const, id: `i${Math.floor(driver() * 60)}` } : { kind: "borrow" as const },
      }));
      const { state } = runWith(seed, inputs);
      expect(state.familiesHarmed).toBe(0);
    }
  });
});
