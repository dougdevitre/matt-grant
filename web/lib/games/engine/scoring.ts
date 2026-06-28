// Shared combo/multiplier math, configured per game. One implementation so the
// "reward sustained correct play" feel is consistent across the four games and is
// unit-testable in isolation. Pure functions — no state, no randomness.

export interface ComboConfig {
  /** correct actions per multiplier step (e.g. 3 → every 3rd correct bumps it) */
  stepEvery: number;
  /** added to the multiplier per step (e.g. 0.25) */
  stepValue: number;
  /** max number of steps the multiplier can climb (caps runaway scoring) */
  maxSteps: number;
}

/** multiplier = 1 + min(maxSteps, floor(streak / stepEvery)) * stepValue. */
export function comboMultiplier(streak: number, cfg: ComboConfig): number {
  if (streak <= 0) return 1;
  const steps = Math.min(cfg.maxSteps, Math.floor(streak / cfg.stepEvery));
  return 1 + steps * cfg.stepValue;
}

/** Apply the combo multiplier to a base value and round to a whole point gain. */
export function applyMultiplier(baseValue: number, streak: number, cfg: ComboConfig): number {
  return Math.round(baseValue * comboMultiplier(streak, cfg));
}

/** Clamp a value into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
