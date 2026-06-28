import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeTheDocket, scoreCeiling, type DocketInput } from "./reducer";
import { parseMaze, isOpen } from "./maze";
import { DocketConfigSchema, type DocketConfig } from "./config.schema";
import { docketConfig, buildTheDocket } from "./content";

const cfg: DocketConfig = docketConfig;

// A tiny, fully-reasoned maze for movement/clear tests: player in a 2-pellet corridor,
// the ghost boxed in so it can't interfere. Steps every tick for fast assertions.
const tiny: DocketConfig = DocketConfigSchema.parse({
  maze: ["#######", "#P..#G#", "#######"],
  playerStepTicks: 1,
  ghostStepTicks: 1,
  startLives: 3,
  roundTicks: 300,
  scoring: { pelletValue: 10, clearBonus: 100 },
});

const run = (config: DocketConfig, seed: string, inputs: InputEvent<DocketInput>[]) =>
  replay(makeTheDocket(config), config, seed, inputs, config.roundTicks);

describe("The Docket — maze parsing", () => {
  it("reads dimensions, pellets, and the P/G starts", () => {
    const m = parseMaze(cfg.maze);
    expect(m.height).toBe(cfg.maze.length);
    expect(m.width).toBe(cfg.maze[0].length);
    expect(m.pellets.size).toBe(cfg.maze.join("").split(".").length - 1);
    expect(isOpen(m, m.playerStart.col, m.playerStart.row)).toBe(true);
    expect(isOpen(m, m.ghostStart.col, m.ghostStart.row)).toBe(true);
  });
});

describe("The Docket — movement + clear", () => {
  it("the player moves through the corridor, eats both pellets, and clears", () => {
    const { state, score } = run(tiny, "clear", [{ tick: 0, input: { kind: "turn", dir: "right" } }]);
    expect(state.pelletsEaten).toBe(2);
    expect(state.pellets.size).toBe(0);
    expect(state.cleared).toBe(true);
    expect(score.flags).toContain("cleared");
    expect(score.total).toBe(2 * 10 + 100);
  });

  it("walls block movement — turning into a wall keeps the player put", () => {
    // 'up' from the corridor is a wall; the player should not move or eat.
    const { state } = run(tiny, "wall", [{ tick: 0, input: { kind: "turn", dir: "up" } }]);
    expect(state.pelletsEaten).toBe(0);
    expect(state.player.row).toBe(1); // unchanged
  });
});

describe("The Docket — deterministic ghost + collision", () => {
  it("the ghost chases a stationary player and eventually ends the run", () => {
    const { state } = run(cfg, "chase", []); // no inputs → player idles, ghost hunts
    expect(state.caughtCount).toBeGreaterThanOrEqual(1);
    expect(state.lives).toBeLessThan(cfg.startLives);
  });
});

describe("The Docket — determinism (client ≡ server replay)", () => {
  it("same (seed, inputs) → identical final state + score", () => {
    const inputs: InputEvent<DocketInput>[] = [
      { tick: 0, input: { kind: "turn", dir: "left" } },
      { tick: 30, input: { kind: "turn", dir: "up" } },
      { tick: 90, input: { kind: "turn", dir: "right" } },
    ];
    const a = run(cfg, "det", inputs);
    const b = run(cfg, "det", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
    expect(b.score.total).toBeLessThanOrEqual(b.score.ceiling);
  });
});

describe("The Docket — property fuzz (any inputs)", () => {
  it("entities never enter walls; lives ∈ [0,start]; score ∈ [0,ceiling]", () => {
    const driver = makeRng("fuzz");
    const maze = parseMaze(cfg.maze);
    const dirs = ["up", "down", "left", "right"] as const;
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 60; trial++) {
      const n = Math.floor(driver() * 20);
      const inputs: InputEvent<DocketInput>[] = Array.from({ length: n }, () => ({
        tick: Math.floor(driver() * cfg.roundTicks),
        input: { kind: "turn" as const, dir: dirs[Math.floor(driver() * 4)] },
      }));
      const { state, score } = run(cfg, `f-${trial}`, inputs);
      expect(isOpen(maze, state.player.col, state.player.row)).toBe(true);
      expect(isOpen(maze, state.ghost.col, state.ghost.row)).toBe(true);
      expect(state.lives).toBeGreaterThanOrEqual(0);
      expect(state.lives).toBeLessThanOrEqual(cfg.startLives);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });
});
