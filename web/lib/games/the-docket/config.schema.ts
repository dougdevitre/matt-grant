import { z } from "zod";

// Mechanics config for "The Docket" (Children First) — a Pac-Man-style maze chase.
// Reframed per direction: the SYSTEM ("the Docket") consumes a child's childhood. You
// play an advocate collecting the childhood (pellets) before the System's mechanisms
// (ghosts) reach you. PHASE 1 = one maze + one ghost; deterministic + replay-validated.
//
// The maze is ASCII data so non-engineers can edit layouts:
//   '#' wall · '.' pellet (childhood) · ' ' empty path · 'P' player start · 'G' ghost start

export const DIRS = ["up", "down", "left", "right"] as const;
export type Dir = (typeof DIRS)[number];

export const DocketConfigSchema = z
  .object({
    /** maze rows; all the same length, bordered by walls, with one P and one G */
    maze: z.array(z.string().min(3)).min(3),
    /** the player advances one cell every N ticks (lower = faster) */
    playerStepTicks: z.number().int().min(1).max(30),
    /** the ghost advances one cell every N ticks (keep ≥ player's so it's catchable) */
    ghostStepTicks: z.number().int().min(1).max(30),
    /** times the player can be caught before the run ends */
    startLives: z.number().int().min(1).max(9),
    /** safety cap so a stalled run still terminates (normally ends on clear/death) */
    roundTicks: z.number().int().min(300).max(20000),
    scoring: z
      .object({
        pelletValue: z.number().int().positive(),
        clearBonus: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .refine((c) => c.maze.every((r) => r.length === c.maze[0].length), "all maze rows must be the same length")
  .refine((c) => c.maze.join("").split("P").length === 2, "maze must contain exactly one 'P' (player start)")
  .refine((c) => c.maze.join("").split("G").length === 2, "maze must contain exactly one 'G' (ghost start)");

export type DocketConfig = z.infer<typeof DocketConfigSchema>;
