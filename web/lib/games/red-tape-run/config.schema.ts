import { z } from "zod";

// Mechanics config for Red Tape Run (Children First) — a Pitfall-style runner. You
// auto-scroll through the family-court process; JUMP to dodge procedural-abuse hazards,
// stay GROUNDED to grab accountability/transparency reforms. Two-sided constraint: you
// can't be airborne and grounded at once, so spam-jumping clears abuses but misses
// reforms, and never jumping collects reforms but the abuses grind you down.
//
// Pure config → the reducer is replay-deterministic and unit-testable. Physics are in
// abstract world units advanced per fixed tick (no wall-clock).

export const EntityKindSchema = z.enum(["abuse", "reform"]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const RedTapeRunConfigSchema = z
  .object({
    roundTicks: z.number().int().min(150).max(3000),
    /** world units the track scrolls per tick */
    scrollSpeed: z.number().positive(),
    /** integrity (health) start; hitting an abuse subtracts damage; 0 ends the run */
    integrityStart: z.number().int().min(1).max(100),
    /** integrity lost per abuse hit */
    hitDamage: z.number().int().positive(),
    /** upward velocity imparted by a jump (world units/tick) */
    jumpVelocity: z.number().positive(),
    /** gravity pulling the player down each tick (world units/tick²) */
    gravity: z.number().positive(),
    /** player must be at/above this height to clear an abuse */
    clearHeight: z.number().positive(),
    /** player must be at/below this height (near ground) to grab a reform */
    grabHeight: z.number().nonnegative(),
    /** spacing between spawned entities, drawn per gap (world units) */
    minGap: z.number().positive(),
    maxGap: z.number().positive(),
    /** relative spawn weights */
    items: z.record(EntityKindSchema, z.object({ weight: z.number().nonnegative() }).strict()),
    scoring: z
      .object({
        reformValue: z.number().int().positive(),
        clearBonus: z.number().int().nonnegative(),
        /** points per tick survived (rewards reaching the end intact) */
        survivalPerTick: z.number().int().nonnegative(),
        combo: z
          .object({ stepEvery: z.number().int().positive(), stepValue: z.number().positive(), maxSteps: z.number().int().positive() })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .refine((c) => c.maxGap >= c.minGap, "maxGap must be ≥ minGap")
  .refine((c) => c.grabHeight < c.clearHeight, "grabHeight must be < clearHeight");

export type RedTapeRunConfig = z.infer<typeof RedTapeRunConfigSchema>;
