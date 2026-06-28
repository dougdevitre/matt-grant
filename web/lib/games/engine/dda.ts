// Dynamic difficulty controller. Nudges a difficulty knob (e.g. spawn interval,
// hazard ratio) toward a target rolling accuracy so the game self-tunes to the
// player. Deterministic: it reads only sim-derived numbers (accuracy so far), never
// wall-clock — so a DDA-driven game still replays identically given (seed, inputs).
//
// Proportional controller with clamped output. We deliberately keep it P-only (no
// integral/derivative term) because the sim is short (<60s) and a simple proportional
// nudge is stable, easy to reason about, and trivially testable. The clamp bounds
// guarantee difficulty never runs away in either direction.
import { clamp } from "./scoring";

export interface DdaConfig {
  /** rolling accuracy we steer toward, in [0,1] (e.g. 0.72) */
  targetAccuracy: number;
  /** knob value at exactly target accuracy */
  base: number;
  /** how hard to react to error (knob units per 1.0 accuracy error) */
  gain: number;
  /** output clamp */
  min: number;
  max: number;
  /** if true, higher accuracy RAISES the knob (e.g. harder = longer is wrong → set false) */
  invert?: boolean;
}

/**
 * Map current accuracy → a difficulty knob value.
 * error = accuracy - target. Playing ABOVE target (error > 0) should make the game
 * harder; for a "spawn interval" knob harder means SMALLER, so invert=true subtracts.
 */
export function ddaKnob(accuracy: number, cfg: DdaConfig): number {
  const error = clamp(accuracy, 0, 1) - cfg.targetAccuracy;
  const delta = cfg.gain * error * (cfg.invert ? -1 : 1);
  return clamp(cfg.base + delta, cfg.min, cfg.max);
}

/** Rolling accuracy from running correct/total counts; 1.0 before any attempts (lenient start). */
export function accuracy(correct: number, total: number): number {
  return total <= 0 ? 1 : correct / total;
}
