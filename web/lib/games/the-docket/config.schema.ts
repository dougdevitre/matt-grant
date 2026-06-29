import { z } from "zod";

// Mechanics config for "The Docket" (Children First) — a Pac-Man-style maze chase.
// Reframed per direction: the SYSTEM ("the Docket") consumes a child's childhood. You
// play an advocate collecting the childhood (pellets) before the System's mechanisms
// (ghosts) reach you. PHASE 3 = the same maze across N escalating stages ("larger
// assignments"): ghosts speed up each stage, and a MORAL-INJURY meter climbs every
// stage you clear — the point being that winning more mazes can't fix a rigged system.
// Deterministic + replay-validated (frightened-flee is distance-based, not random, so
// no RNG enters the sim).
//
// The maze is ASCII data so non-engineers can edit layouts:
//   '#' wall · '.' pellet (childhood) · 'o' power pellet (a Reform) · ' ' empty path
//   'P' player start · 'G' ghost start (1–4 of them)

export const DIRS = ["up", "down", "left", "right"] as const;
export type Dir = (typeof DIRS)[number];

export const DocketConfigSchema = z
  .object({
    /** maze rows; all the same length, bordered by walls, with one P and 1–4 G's */
    maze: z.array(z.string().min(3)).min(3),
    /** the player advances one cell every N ticks (lower = faster) */
    playerStepTicks: z.number().int().min(1).max(30),
    /** ghosts advance one cell every N ticks at STAGE 1 (keep ≥ player's so they're catchable) */
    ghostStepTicks: z.number().int().min(1).max(30),
    /** number of escalating stages ("larger assignments") in one run */
    stages: z.number().int().min(1).max(20),
    /** each stage past the first lowers ghostStepTicks by this (ghosts get faster) */
    ghostSpeedupPerStage: z.number().int().min(0).max(5),
    /** ghosts never step faster than this many ticks/cell, no matter the stage */
    minGhostStepTicks: z.number().int().min(1).max(30),
    /** the moral-injury meter (0–100) climbs by this each stage cleared */
    moralInjuryPerStage: z.number().int().min(0).max(100),
    /** times the player can be caught before the run ends */
    startLives: z.number().int().min(1).max(9),
    /** safety cap so a stalled run still terminates (normally ends on clear/death) */
    roundTicks: z.number().int().min(300).max(120000),
    /** how long a power pellet keeps ghosts frightened (edible), in ticks */
    powerDurationTicks: z.number().int().min(30).max(900),
    /** ghost i activates at i × this many ticks — staggered release eases the open */
    ghostReleaseTicks: z.number().int().min(0).max(900),
    /** the player can't be caught for this many ticks at the start / after a catch */
    spawnGraceTicks: z.number().int().min(0).max(300),
    scoring: z
      .object({
        pelletValue: z.number().int().positive(),
        powerValue: z.number().int().nonnegative(),
        /** awarded each time a stage (1..stages-1) is cleared and the next begins */
        stageBonus: z.number().int().nonnegative(),
        /** awarded once for clearing the FINAL stage (the whole run) */
        clearBonus: z.number().int().nonnegative(),
        /** eating a frightened ghost scores this × 2^(chain) within one power window */
        ghostBaseValue: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .refine((c) => c.maze.every((r) => r.length === c.maze[0].length), "all maze rows must be the same length")
  .refine((c) => c.maze.join("").split("P").length === 2, "maze must contain exactly one 'P' (player start)")
  .refine((c) => {
    const g = c.maze.join("").split("G").length - 1;
    return g >= 1 && g <= 4;
  }, "maze must contain 1–4 'G' ghost starts");

export type DocketConfig = z.infer<typeof DocketConfigSchema>;
