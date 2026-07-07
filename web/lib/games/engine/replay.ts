import type { Game, InputEvent, StepContext } from "./types";
import { makeRng } from "./rng";

// THE single source of truth for advancing a game. The client runs replay() to
// render/preview; the /api/games/score handler runs the SAME replay() to validate
// a submitted score. One code path, two consumers → if the recomputed score doesn't
// match the reported one, the submission is rejected (anti-cheat).
//
// Determinism contract: replay(game, config, seed, inputs, totalTicks) is a pure
// function of its arguments. No wall-clock, no Math.random — randomness flows only
// from the seeded ctx.rng built here.

export const DEFAULT_DT_MS = 1000 / 30; // 30 Hz fixed sim timestep (canonical for replay)

// Global playback-speed scalar for the LIVE client loop only. The sim is tick-based
// and dt-independent, so scaling how fast wall-clock drains into ticks slows every
// game's on-screen motion without touching reducers, scoring, or the server replay
// path (which calls replay() below, never the live loop). 0.5 = half speed.
export const GAME_SPEED = 0.5;

// Real milliseconds of wall-clock per sim tick under GAME_SPEED — the number the
// client HUD countdowns should use so they show honest real-time seconds.
export const EFFECTIVE_DT_MS = DEFAULT_DT_MS / GAME_SPEED;

export interface ReplayResult<S> {
  state: S;
  score: ReturnType<Game<S, unknown, unknown>["score"]>;
}

export function replay<S, I, C>(
  game: Game<S, I, C>,
  config: C,
  seed: string,
  inputs: InputEvent<I>[],
  totalTicks: number,
  dtMs: number = DEFAULT_DT_MS,
): ReplayResult<S> {
  const rng = makeRng(seed);
  const baseCtx: StepContext = { tick: 0, dtMs, rng };
  let state = game.init(config, baseCtx);

  // Bucket inputs by the tick they apply on, preserving submission order within a tick.
  const byTick = new Map<number, I[]>();
  for (const e of inputs) {
    const bucket = byTick.get(e.tick);
    if (bucket) bucket.push(e.input);
    else byTick.set(e.tick, [e.input]);
  }

  for (let t = 0; t <= totalTicks && !game.isOver(state); t++) {
    state = game.step(state, byTick.get(t) ?? [], { tick: t, dtMs, rng });
  }

  return { state, score: game.score(state) };
}
