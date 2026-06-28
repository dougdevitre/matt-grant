import { z } from "zod";

// Numeric tuning + item table for Cut & Save (Lower Taxes). This is the *mechanics*
// config — distinct from the player-facing copy in content/games/cut-and-save.json,
// which a non-engineer edits without touching this schema. The reducer is a pure
// function of this config + (seed, inputs), so changing a weight here is fully
// replay-deterministic and unit-testable.

export const ItemTypeSchema = z.enum(["waste", "essential", "decoy"]);
export type ItemType = z.infer<typeof ItemTypeSchema>;

const ItemSpawnSchema = z
  .object({
    /** relative spawn weight (drawn via the seeded rng) */
    weight: z.number().nonnegative(),
    /** inclusive value range a spawned item of this type is worth */
    minValue: z.number().int().nonnegative(),
    maxValue: z.number().int().nonnegative(),
  })
  .strict()
  .refine((s) => s.maxValue >= s.minValue, "maxValue must be ≥ minValue");

export const CutSaveConfigSchema = z
  .object({
    /** total simulation ticks in a round (at the engine's fixed 30 Hz) */
    roundTicks: z.number().int().min(150).max(3000),
    /** a new item spawns every N ticks */
    spawnEveryTicks: z.number().int().min(3).max(120),
    /** ticks an item stays on the board before it expires */
    itemLifeTicks: z.number().int().min(10).max(600),
    /** relief total that drives taxPct to the floor */
    reliefTarget: z.number().int().positive(),
    /** taxPct = clamp(100 - (effectiveRelief/target)*taxRange, taxFloor, 100) */
    taxFloor: z.number().min(0).max(100),
    taxRange: z.number().positive(),
    combo: z
      .object({ stepEvery: z.number().int().positive(), stepValue: z.number().positive(), maxSteps: z.number().int().positive() })
      .strict(),
    /** relief deducted + a harm tick when an essential is cut */
    essentialHarmPenalty: z.number().int().nonnegative(),
    /** cutting a decoy reduces waste yield for this many ticks (some spending pays for itself) */
    decoyDebuffTicks: z.number().int().nonnegative(),
    /** waste-yield multiplier while the decoy debuff is active, in (0,1] */
    decoyYieldFactor: z.number().min(0).max(1),
    borrow: z
      .object({
        /** instant taxPct reduction the gimmick grants */
        instantTaxRelief: z.number().positive(),
        /** debt added on each borrow */
        debtAdded: z.number().int().positive(),
        /** debt compounds every N ticks */
        compoundEveryTicks: z.number().int().positive(),
        /** compounding rate per interval (e.g. 0.08 = +8%) */
        compoundRate: z.number().positive(),
      })
      .strict(),
    items: z.record(ItemTypeSchema, ItemSpawnSchema),
    /** completion bonuses that make the on-message play the high-score play */
    bonuses: z
      .object({ noFamilyHarmed: z.number().int().nonnegative(), noBorrow: z.number().int().nonnegative() })
      .strict(),
  })
  .strict();

export type CutSaveConfig = z.infer<typeof CutSaveConfigSchema>;
