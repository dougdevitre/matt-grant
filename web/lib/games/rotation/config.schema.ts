import { z } from "zod";

// Mechanics config for Rotation (Term Limits). The effectiveness curve IS the
// argument: a member ramps up, plateaus through a "service sweet spot," then decays
// into entrenchment past the cap. Rotate in the window = good; too early wastes the
// ramp; too late is careerism. Grandfathered incumbents are exempt from the early
// penalty and expire naturally — matching the platform's grandfather clause.
// Pure config → replay-deterministic + testable.

export const RotationConfigSchema = z
  .object({
    roundTicks: z.number().int().min(150).max(3000),
    seatCount: z.number().int().min(1).max(12),
    /** service length (ticks) at which entrenchment/decay begins — the "cap" */
    capTicks: z.number().int().positive(),
    /** width of the sweet-spot window just before the cap: [cap-delta, cap] */
    windowDelta: z.number().int().positive(),
    /** peak effectiveness on the plateau */
    peakEffectiveness: z.number().int().positive(),
    /** effectiveness lost per tick once past the cap (entrenchment decay) */
    decayPerTick: z.number().positive(),
    /** flat penalty for rotating a (non-grandfathered) member before the ramp completes */
    churnPenalty: z.number().int().nonnegative(),
    /** flat penalty for rotating a member after the cap (careerism) */
    entrenchmentPenalty: z.number().int().nonnegative(),
    /** multiplier gained per clean (in-window) rotation */
    cleanBonus: z.number().positive(),
    /** cap on multiplier steps */
    maxCleanSteps: z.number().int().positive(),
    /** how many opening seats are grandfathered incumbents */
    grandfatheredCount: z.number().int().nonnegative(),
    /** grandfathered members auto-expire (term ends naturally) at this service length */
    grandfatherNaturalTerm: z.number().int().positive(),
  })
  .strict()
  .refine((c) => c.windowDelta < c.capTicks, "windowDelta must be < capTicks")
  .refine((c) => c.grandfatheredCount <= c.seatCount, "grandfatheredCount must be ≤ seatCount");

export type RotationConfig = z.infer<typeof RotationConfigSchema>;
