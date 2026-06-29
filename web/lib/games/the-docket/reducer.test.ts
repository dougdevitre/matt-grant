import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeTheDocket, scoreCeiling, type DocketInput } from "./reducer";
import { parseMaze, isOpen } from "./maze";
import { DocketConfigSchema, type DocketConfig } from "./config.schema";
import { docketConfig } from "./content";

const cfg: DocketConfig = docketConfig;

const baseTimings = {
  playerStepTicks: 1,
  ghostStepTicks: 1,
  startLives: 3,
  roundTicks: 300,
  powerDurationTicks: 120,
  ghostReleaseTicks: 0,
  spawnGraceTicks: 0,
  scoring: { pelletValue: 10, powerValue: 50, clearBonus: 100, ghostBaseValue: 200 },
};

// A boxed-ghost corridor for movement/clear (ghost can't interfere). Steps every tick.
const tiny: DocketConfig = DocketConfigSchema.parse({ maze: ["#######", "#P..#G#", "#######"], ...baseTimings });
// A corridor where the player grabs a Reform (power) then collides with the frightened ghost.
const powerMaze: DocketConfig = DocketConfigSchema.parse({ maze: ["#######", "#Po..G#", "#######"], ...baseTimings });

const run = (config: DocketConfig, seed: string, inputs: InputEvent<DocketInput>[]) =>
  replay(makeTheDocket(config), config, seed, inputs, config.roundTicks);

describe("The Docket — maze parsing (Phase 2)", () => {
  it("reads pellets, power pellets, player start, and FOUR ghost starts", () => {
    const m = parseMaze(cfg.maze);
    expect(m.pellets.size).toBe(cfg.maze.join("").split(".").length - 1);
    expect(m.powerPellets.size).toBe(cfg.maze.join("").split("o").length - 1);
    expect(m.ghostStarts.length).toBe(4);
    expect(isOpen(m, m.playerStart.col, m.playerStart.row)).toBe(true);
  });
});

describe("The Docket — movement + clear", () => {
  it("eats the corridor and clears once childhood (and reforms) are gone", () => {
    const { state, score } = run(tiny, "clear", [{ tick: 0, input: { kind: "turn", dir: "right" } }]);
    expect(state.pellets.size).toBe(0);
    expect(state.powerPellets.size).toBe(0);
    expect(state.cleared).toBe(true);
    expect(score.flags).toContain("cleared");
  });
});

describe("The Docket — power-pellet (Reform) mode", () => {
  it("a Reform frightens the system; colliding then EATS a ghost (no life lost)", () => {
    const { state, score } = run(powerMaze, "power", [{ tick: 0, input: { kind: "turn", dir: "right" } }]);
    expect(state.ghostsEaten).toBeGreaterThanOrEqual(1);
    expect(state.caughtCount).toBe(0); // eating a frightened ghost is not a catch
    expect(score.flags).toContain("pushed_back");
    expect(score.total).toBeGreaterThanOrEqual(baseTimings.scoring.ghostBaseValue);
  });
});

describe("The Docket — four ghosts hunt", () => {
  it("idling gets you caught (the system wins if you don't act)", () => {
    const { state } = run(cfg, "idle", []);
    expect(state.ghosts.length).toBe(4);
    expect(state.caughtCount).toBeGreaterThanOrEqual(1);
    expect(state.lives).toBeLessThan(cfg.startLives);
  });
});

describe("The Docket — determinism (client ≡ server replay)", () => {
  it("same (seed, inputs) → identical final state + score", () => {
    const inputs: InputEvent<DocketInput>[] = [
      { tick: 0, input: { kind: "turn", dir: "left" } },
      { tick: 40, input: { kind: "turn", dir: "up" } },
      { tick: 120, input: { kind: "turn", dir: "right" } },
    ];
    const a = run(cfg, "det", inputs);
    const b = run(cfg, "det", inputs);
    expect(b.state).toEqual(a.state);
    expect(b.score.total).toBe(a.score.total);
    expect(b.score.total).toBeLessThanOrEqual(b.score.ceiling);
  });
});

describe("The Docket — property fuzz", () => {
  it("player + all ghosts stay on open cells; lives/score/power in range", () => {
    const driver = makeRng("fuzz");
    const maze = parseMaze(cfg.maze);
    const dirs = ["up", "down", "left", "right"] as const;
    const ceiling = scoreCeiling(cfg);
    for (let trial = 0; trial < 50; trial++) {
      const n = Math.floor(driver() * 24);
      const inputs: InputEvent<DocketInput>[] = Array.from({ length: n }, () => ({
        tick: Math.floor(driver() * cfg.roundTicks),
        input: { kind: "turn" as const, dir: dirs[Math.floor(driver() * 4)] },
      }));
      const { state, score } = run(cfg, `f-${trial}`, inputs);
      expect(isOpen(maze, state.player.col, state.player.row)).toBe(true);
      for (const g of state.ghosts) expect(isOpen(maze, g.col, g.row)).toBe(true);
      expect(state.lives).toBeGreaterThanOrEqual(0);
      expect(state.lives).toBeLessThanOrEqual(cfg.startLives);
      expect(state.powerTicksLeft).toBeGreaterThanOrEqual(0);
      expect(state.powerTicksLeft).toBeLessThanOrEqual(cfg.powerDurationTicks);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(ceiling);
    }
  });
});
