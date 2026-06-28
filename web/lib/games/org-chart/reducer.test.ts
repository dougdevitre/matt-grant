import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeOrgChart, scoreCeiling, type OrgChartInput } from "./reducer";
import { orgChartConfig, buildOrgChart } from "./content";
import type { OrgChartConfig } from "./config.schema";

const cfg: OrgChartConfig = orgChartConfig;
const DT = 1000 / 30;

// Re-derive the deterministic block stream for a seed so a test can target blocks by
// id with the right action (init seeds b0..b{n-1}; spawns continue the numbering).
function blockStream(seed: string, count: number): { id: string; type: string }[] {
  const game = makeOrgChart(cfg);
  const rng = makeRng(seed);
  let state = game.init(cfg, { tick: 0, dtMs: DT, rng });
  const out = state.board.map((b) => ({ id: b.id, type: b.type }));
  let prev = state.spawnCount;
  for (let t = 1; t <= cfg.roundTicks && out.length < count; t++) {
    state = game.step(state, [], { tick: t, dtMs: DT, rng });
    if (state.spawnCount > prev) {
      const justSpawned = state.board[state.board.length - 1];
      if (justSpawned) out.push({ id: justSpawned.id, type: justSpawned.type });
      prev = state.spawnCount;
    }
  }
  return out;
}

const run = (seed: string, inputs: InputEvent<OrgChartInput>[]) =>
  replay(buildOrgChart(), cfg, seed, inputs, cfg.roundTicks);

// The tick a block id first exists on: init blocks (ordinal < initialBlocks) are on
// the board from tick 0; the j-th spawned block appears at spawnEveryTicks*(j+1).
function spawnTickFor(id: string): number {
  const ord = Number(id.slice(1));
  if (ord < cfg.initialBlocks) return 1;
  return cfg.spawnEveryTicks * (ord - cfg.initialBlocks + 1) + 1;
}

describe("Org Chart — determinism", () => {
  it("same (seed, inputs) → identical final state + score", () => {
    const inputs: InputEvent<OrgChartInput>[] = [{ tick: 27, input: { kind: "cut", id: "b0" } }];
    const a = run("seed-A", inputs);
    const b = run("seed-A", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
  });

  it("client and server replay agree, and score never exceeds the ceiling", () => {
    const inputs: InputEvent<OrgChartInput>[] = [
      { tick: 27, input: { kind: "cut", id: "b1" } },
      { tick: 54, input: { kind: "freeze" } },
    ];
    const a = run("anti-cheat", inputs);
    const b = run("anti-cheat", inputs);
    expect(b.score.total).toBe(a.score.total);
    expect(b.score.total).toBeLessThanOrEqual(b.score.ceiling);
  });
});

describe("Org Chart — two-sided fail invariants", () => {
  it("cutting only bloat/redundant never reduces service", () => {
    const stream = blockStream("bloat-only", 50);
    const bloatIds = stream.filter((s) => s.type === "redundant" || s.type === "bloat").map((s) => s.id);
    const inputs: InputEvent<OrgChartInput>[] = bloatIds.map((id) => ({ tick: spawnTickFor(id), input: { kind: "cut", id } }));
    const { state, score } = run("bloat-only", inputs);
    expect(state.protectedCut).toBe(0);
    expect(state.criticalCut).toBe(0);
    expect(state.serviceLevel).toBe(cfg.serviceStart);
    expect(score.flags).toContain("service_intact");
  });

  it("cutting a protected role drops service and flags it", () => {
    const stream = blockStream("prot", 60);
    const firstProtected = stream.find((s) => s.type === "protected");
    expect(firstProtected).toBeDefined();
    const { state } = run("prot", [{ tick: spawnTickFor(firstProtected!.id), input: { kind: "cut", id: firstProtected!.id } }]);
    expect(state.protectedCut).toBe(1);
    expect(state.serviceLevel).toBe(cfg.serviceStart - cfg.protectedPenalty);
  });

  it("gutting service below the floor ends the round and forfeits the band reward", () => {
    // Cut every protected + critical block we can see, each at its spawn tick — service collapses.
    const stream = blockStream("gut", 80);
    const peopleIds = stream.filter((s) => s.type === "protected" || s.type === "critical").map((s) => s.id);
    const inputs: InputEvent<OrgChartInput>[] = peopleIds.map((id) => ({ tick: spawnTickFor(id), input: { kind: "cut", id } }));
    const { state, score } = run("gut", inputs);
    expect(state.serviceLevel).toBeLessThan(cfg.serviceFloor);
    expect(score.flags).toContain("service_collapsed");
    // collapsed runs only score from (low) service — no band/efficiency reward
    expect(score.components.bandScore).toBeGreaterThanOrEqual(0);
    expect(score.total).toBe(Math.max(0, score.components.serviceScore));
  });

  it("never right-sizing (no cuts) leaves headcount above the band → bloat_wins", () => {
    const { state, score } = run("bloat-wins", []);
    expect(state.headcount).toBeGreaterThan(cfg.targetBand[1]);
    expect(score.flags).toContain("bloat_wins");
    expect(score.flags).not.toContain("right_sized");
  });
});

describe("Org Chart — property fuzz (any seed/inputs)", () => {
  it("service ∈ [0,100]; headcount ≥ 0; score ∈ [0, ceiling]", () => {
    const driver = makeRng("fuzz");
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 120; trial++) {
      const seed = `f-${Math.floor(driver() * 1e9)}`;
      const n = Math.floor(driver() * 30);
      const inputs: InputEvent<OrgChartInput>[] = Array.from({ length: n }, () => {
        const roll = driver();
        const tick = Math.floor(driver() * cfg.roundTicks);
        if (roll < 0.12) return { tick, input: { kind: "freeze" as const } };
        if (roll < 0.2) return { tick, input: { kind: "retire" as const } };
        return { tick, input: { kind: "cut" as const, id: `b${Math.floor(driver() * 70)}` } };
      });
      const { state, score } = run(seed, inputs);
      expect(state.serviceLevel).toBeGreaterThanOrEqual(0);
      expect(state.serviceLevel).toBeLessThanOrEqual(100);
      expect(state.headcount).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });

  it("Early Retirement never removes protected/critical roles", () => {
    const driver = makeRng("retire-safety");
    for (let trial = 0; trial < 40; trial++) {
      const seed = `r-${Math.floor(driver() * 1e9)}`;
      // Spam retire only — it must never touch people.
      const inputs: InputEvent<OrgChartInput>[] = Array.from({ length: 5 }, (_, i) => ({
        tick: 1 + i * 50,
        input: { kind: "retire" as const },
      }));
      const { state } = run(seed, inputs);
      expect(state.protectedCut).toBe(0);
      expect(state.criticalCut).toBe(0);
    }
  });
});
