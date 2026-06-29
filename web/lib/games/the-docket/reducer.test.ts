import { describe, it, expect } from "vitest";
import { replay, makeRng, type InputEvent } from "@/lib/games/engine";
import { makeTheDocket, scoreCeiling, ghostStepFor, type DocketInput } from "./reducer";
import { parseMaze, isOpen } from "./maze";
import { DocketConfigSchema, type DocketConfig } from "./config.schema";
import { docketConfig, docketContent } from "./content";

const cfg: DocketConfig = docketConfig;

// Single-stage defaults so the corridor fixtures clear the whole run in one maze.
const baseTimings = {
  playerStepTicks: 1,
  ghostStepTicks: 1,
  stages: 1,
  ghostSpeedupPerStage: 0,
  minGhostStepTicks: 1,
  moralInjuryPerStage: 0,
  startLives: 3,
  roundTicks: 300,
  powerDurationTicks: 120,
  ghostReleaseTicks: 0,
  spawnGraceTicks: 0,
  scoring: { pelletValue: 10, powerValue: 50, stageBonus: 25, clearBonus: 100, ghostBaseValue: 200 },
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

describe("The Docket — stages + moral injury (Phase 3)", () => {
  // Two-pellet corridor with a boxed ghost; one input clears stage 1 cleanly.
  const adv: DocketConfig = DocketConfigSchema.parse({
    maze: ["#######", "#P..#G#", "#######"],
    ...baseTimings,
    stages: 2,
    moralInjuryPerStage: 30,
  });

  it("ghosts step faster each stage, floored at minGhostStepTicks", () => {
    expect(ghostStepFor(1, cfg)).toBe(cfg.ghostStepTicks);
    expect(ghostStepFor(2, cfg)).toBe(cfg.ghostStepTicks - cfg.ghostSpeedupPerStage);
    expect(ghostStepFor(cfg.stages, cfg)).toBe(cfg.minGhostStepTicks); // late stages hit the floor
    expect(ghostStepFor(99, cfg)).toBeGreaterThanOrEqual(cfg.minGhostStepTicks);
  });

  it("clearing a stage advances to the next (not a full win), climbs moral injury, pays a stage bonus", () => {
    const { state, score } = run(adv, "advance", [{ tick: 0, input: { kind: "turn", dir: "right" } }]);
    expect(state.stage).toBe(2); // moved on to the larger assignment
    expect(state.cleared).toBe(false); // the RUN isn't won until the final stage
    expect(state.moralInjury).toBe(30); // one stage cleared
    expect(state.powerPellets.size + state.pellets.size).toBeGreaterThan(0); // board refilled
    expect(score.flags).not.toContain("cleared");
    expect(score.total).toBeGreaterThanOrEqual(2 * baseTimings.scoring.pelletValue + baseTimings.scoring.stageBonus);
  });

  it("clearing the FINAL stage wins the run and can max the moral-injury meter", () => {
    const full: DocketConfig = DocketConfigSchema.parse({
      maze: ["#######", "#P..#G#", "#######"],
      ...baseTimings,
      stages: 2,
      moralInjuryPerStage: 50,
    });
    const { state, score } = run(full, "fullclear", [
      { tick: 0, input: { kind: "turn", dir: "right" } },
      { tick: 3, input: { kind: "turn", dir: "right" } },
    ]);
    expect(state.cleared).toBe(true);
    expect(state.stage).toBe(2); // stayed on the final stage (no further reset)
    expect(state.moralInjury).toBe(100); // 2 × 50, the toll the maze couldn't undo
    expect(score.flags).toEqual(expect.arrayContaining(["cleared", "moral_injury"]));
    expect(score.total).toBeLessThanOrEqual(score.ceiling);
  });
});

describe("The Docket — reform-plan ending (Phase 4)", () => {
  it("ships a moral-injury beat + a faithful reform plan", () => {
    const e = docketContent.ending;
    expect(e).toBeDefined();
    expect(e!.beatWon).toMatch(/cleared/i);
    expect(e!.beatLost).toMatch(/caught/i);
    expect(e!.body.length).toBeGreaterThanOrEqual(1);
    expect(e!.reformPlan.length).toBe(10); // ten stages → ten steps
    // The core documented platform must be present (no invented policy beyond it).
    const blob = e!.reformPlan.map((s) => `${s.title} ${s.detail}`).join(" ").toLowerCase();
    expect(blob).toContain("child protection act of 2027");
    expect(blob).toContain("title iv-d");
    expect(blob).toContain("term limits");
    expect(blob).toContain("grandfather clause");
    expect(blob).toContain("hiring freeze");
    expect(e!.cta.href.startsWith("/")).toBe(true); // internal link only
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
