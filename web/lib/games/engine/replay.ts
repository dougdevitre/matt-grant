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

export const DEFAULT_DT_MS = 1000 / 30; // 30 Hz fixed timestep

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
