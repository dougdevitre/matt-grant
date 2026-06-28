import { z } from "zod";

// Mechanics config for Org Chart (Smaller Government). Tuning lives here; player copy
// lives in content/games/org-chart.json. The reducer is a pure function of this config
// + (seed, inputs), so balance changes stay replay-deterministic and testable.

export const BlockTypeSchema = z.enum(["redundant", "bloat", "protected", "critical"]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

const BlockSpawnSchema = z
  .object({ weight: z.number().nonnegative() })
  .strict();

export const OrgChartConfigSchema = z
  .object({
    roundTicks: z.number().int().min(150).max(3000),
    spawnEveryTicks: z.number().int().min(3).max(120),
    /** positions on the board when the round opens (drawn from the item table) */
    initialBlocks: z.number().int().min(0).max(60),
    /** [min, max] headcount band you must land inside — the "right size" */
    targetBand: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]),
    /** service starts here (0–100) and only drops when you cut protected/critical roles */
    serviceStart: z.number().int().min(0).max(100),
    /** cutting too deep below this ends the round in failure (families left behind) */
    serviceFloor: z.number().int().min(0).max(100),
    /** service lost per protected role cut (veterans/kids/families) */
    protectedPenalty: z.number().int().nonnegative(),
    /** service lost per critical role cut (infrastructure) */
    criticalPenalty: z.number().int().nonnegative(),
    /** Hiring Freeze pauses spawns this many ticks */
    freezeTicks: z.number().int().positive(),
    /** ...and can't be used again until this many ticks pass */
    freezeCooldownTicks: z.number().int().positive(),
    /** Early Retirement clears up to this many redundant/bloat blocks (spares protected/critical) */
    retireClears: z.number().int().positive(),
    /** how many times Early Retirement can be used in a round */
    retireMaxUses: z.number().int().nonnegative(),
    items: z.record(BlockTypeSchema, BlockSpawnSchema),
    scoring: z
      .object({
        /** points for finishing inside the band */
        bandBase: z.number().int().positive(),
        /** points deducted per headcount unit outside the band */
        outOfBandPenalty: z.number().int().nonnegative(),
        /** points per remaining service point */
        servicePerPoint: z.number().int().nonnegative(),
        /** points per tick spent inside the band (rewards settling fast + staying) */
        efficiencyPerTickInBand: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .refine((c) => c.targetBand[1] >= c.targetBand[0], "targetBand max must be ≥ min")
  .refine((c) => c.serviceFloor <= c.serviceStart, "serviceFloor must be ≤ serviceStart");

export type OrgChartConfig = z.infer<typeof OrgChartConfigSchema>;
