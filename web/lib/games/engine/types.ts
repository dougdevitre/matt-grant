// Shared engine contract for the Four Fights civic mini-game arcade
// (games.mattgrantforcongress.org). Framework-agnostic — NO React, NO I/O.
//
// Core thesis: every game is a PURE state machine advanced by a fixed timestep and
// driven by a SEEDED rng. Given (seed, inputs[]) the final score is reproducible on
// client and server — which is what makes scoring unit-testable and server-side
// replay validation (anti-cheat) possible. See ./replay.ts for the single code path
// both consumers run.
//
// PURITY (matches the repo's React-compiler convention used in lib/actions.ts):
// no Math.random / Date.now / wall-clock inside init/step/score/isOver. The ONLY
// source of randomness is ctx.rng (seeded in ./rng.ts). The seed itself is minted
// once at session start in a client component, never inside the sim.

export type Seed = string;

/** A single timestamped player action. Pure data so a session is serializable + replayable. */
export interface InputEvent<TInput> {
  /** simulation tick at which the input applies (fixed-step, deterministic) */
  tick: number;
  input: TInput;
}

export interface StepContext {
  tick: number;
  /** fixed timestep in ms (e.g. 1000/30) — sims advance by this, never wall-clock */
  dtMs: number;
  /** seeded PRNG in [0,1); the ONLY source of randomness inside a sim */
  rng: () => number;
}

/** Every game implements this. No wall-clock, no Math.random, no I/O inside. */
export interface Game<TState, TInput, TConfig> {
  id: string;
  init(config: TConfig, ctx: StepContext): TState;
  /** advance one fixed tick; apply any inputs scheduled for this tick */
  step(state: TState, inputs: TInput[], ctx: StepContext): TState;
  isOver(state: TState): boolean;
  score(state: TState): ScoreBreakdown;
}

export interface ScoreBreakdown {
  total: number;
  /** named contributions, e.g. { relief, comboBonus, penalties } */
  components: Record<string, number>;
  /** qualitative outcome tags, e.g. ["no_family_harmed"] */
  flags: string[];
  /** theoretical max given config + ticks — used for the server-side clamp */
  ceiling: number;
}

/** Wire shape a client submits to /api/games/score for replay validation. */
export interface ScoreSubmission<TInput> {
  gameId: string;
  seed: Seed;
  inputs: InputEvent<TInput>[];
  totalTicks: number;
  reportedScore: number;
}
