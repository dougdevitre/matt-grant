import { z } from "zod";

// Mechanics config for Clarity Companion (Children First). Triage records under
// pressure: OPEN public-interest records, PROTECT child-identifying ones, and
// REDACT & OPEN the mixed ones (public substance, masked child). The two-sided
// constraint is the lesson: seal too much and Accountability crashes; expose a kid
// and Child Privacy crashes — transparency and privacy must coexist.
//
// TONE: records are GENERIC TYPES only (enforced by the content tone guardrail).
// No names, no real cases. This game ships behind a compliance review.

export const RecordTypeSchema = z.enum(["public", "child", "mixed"]);
export type RecordType = z.infer<typeof RecordTypeSchema>;

const RecordSpawnSchema = z.object({ weight: z.number().nonnegative() }).strict();

export const ClarityConfigSchema = z
  .object({
    roundTicks: z.number().int().min(150).max(3000),
    spawnEveryTicks: z.number().int().min(3).max(120),
    /** a record auto-resolves as "missed" if not handled within this many ticks */
    cardLifeTicks: z.number().int().min(15).max(900),
    /** both meters start here (0–100) */
    meterStart: z.number().int().min(0).max(100),
    /** a meter below this floor at the end is a fail */
    meterFloor: z.number().int().min(0).max(100),
    /** meter gained for a correct OPEN / PROTECT / each side of REDACT&OPEN */
    correctGain: z.number().int().positive(),
    /** Child Privacy lost when a child record is exposed (wrong OPEN / redact-on-pure-child) */
    exposeCrash: z.number().int().positive(),
    /** Accountability lost when a public record is sealed (wrong PROTECT) */
    sealCrash: z.number().int().positive(),
    /** smaller Child Privacy hit for redacting a pure-child record (shouldn't open it at all) */
    minorCrash: z.number().int().positive(),
    items: z.record(RecordTypeSchema, RecordSpawnSchema),
    scoring: z
      .object({
        /** weight on the WEAKER meter (forces balance — can't win on one) */
        minMeterWeight: z.number().int().nonnegative(),
        /** weight on the meter sum */
        sumMeterWeight: z.number().int().nonnegative(),
        /** points per correct resolution, scaled by the combo multiplier */
        correctBonus: z.number().int().nonnegative(),
        combo: z
          .object({ stepEvery: z.number().int().positive(), stepValue: z.number().positive(), maxSteps: z.number().int().positive() })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .refine((c) => c.meterFloor <= c.meterStart, "meterFloor must be ≤ meterStart");

export type ClarityConfig = z.infer<typeof ClarityConfigSchema>;
