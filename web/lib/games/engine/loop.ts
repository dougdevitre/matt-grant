import type { Game, InputEvent, StepContext } from "./types";
import { makeRng } from "./rng";
import { DEFAULT_DT_MS, GAME_SPEED } from "./replay";

// Cap a single frame's elapsed time so a backgrounded tab (or a long GC pause)
// can't dump hundreds of queued ticks in one advance() and fast-forward the run.
const MAX_FRAME_MS = 250;

// Fixed-timestep accumulator for CLIENT rendering only. The sim still advances by
// whole ticks (so play stays identical to ./replay.ts), but this lets a rAF/interval
// loop feed real elapsed time in and drain it into discrete steps — decoupling render
// framerate from sim rate. Inputs the player makes are stamped with the CURRENT tick
// and recorded so the same (seed, inputs[]) can be re-run by replay() for validation.
//
// Server validation never uses this — it calls replay() directly. Keeping the loop
// thin and the stepping logic shared means the two can't drift.

export interface LiveSession<S, I> {
  /** current sim state (post last drained tick) */
  state: S;
  /** current tick the sim has advanced to */
  tick: number;
  /** every input recorded this session, in apply order — feed to replay() to validate */
  readonly inputs: InputEvent<I>[];
  /** queue a player action; it applies on the next drained tick */
  enqueue(input: I): void;
  /** advance the sim by however many whole ticks `elapsedMs` covers; returns ticks stepped */
  advance(elapsedMs: number): number;
  /** fractional progress toward the next tick (0..1) — for render interpolation */
  readonly alpha: number;
  isOver(): boolean;
}

export function createLiveSession<S, I, C>(
  game: Game<S, I, C>,
  config: C,
  seed: string,
  dtMs: number = DEFAULT_DT_MS,
): LiveSession<S, I> {
  const rng = makeRng(seed);
  const ctx: StepContext = { tick: 0, dtMs, rng };
  let state = game.init(config, ctx);
  let tick = 0;
  let acc = 0;
  const inputs: InputEvent<I>[] = [];
  const pending: I[] = [];

  return {
    get state() {
      return state;
    },
    get tick() {
      return tick;
    },
    inputs,
    enqueue(input: I) {
      pending.push(input);
    },
    get alpha() {
      return Math.min(1, acc / dtMs);
    },
    advance(elapsedMs: number): number {
      // Clamp then slow: GAME_SPEED shrinks how much wall-clock drains into ticks,
      // halving on-screen speed while the sim stays byte-identical to replay().
      acc += Math.min(elapsedMs, MAX_FRAME_MS) * GAME_SPEED;
      let stepped = 0;
      while (acc >= dtMs && !game.isOver(state)) {
        acc -= dtMs;
        // Drain inputs queued since the last tick onto THIS tick, and record them
        // so replay() applies them at the identical tick.
        const applied = pending.splice(0, pending.length);
        for (const input of applied) inputs.push({ tick, input });
        state = game.step(state, applied, { tick, dtMs, rng });
        tick++;
        stepped++;
      }
      return stepped;
    },
    isOver() {
      return game.isOver(state);
    },
  };
}
