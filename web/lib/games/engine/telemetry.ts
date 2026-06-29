// Typed telemetry taxonomy for the arcade. Surfaces the funnel metrics that tell us
// whether a game is working: completion rate, REPLAY rate (addictiveness), share
// rate, opt-in rate, issue click-through (back to the priority page), and the
// score-reject rate (anti-cheat health).
//
// This module only DEFINES the event shapes and a tiny emitter abstraction — it does
// not pick a sink. The shell wires emit() to whatever analytics transport is enabled
// (or a no-op when none is). Keeping it typed means call sites can't emit a malformed
// event, and a new event variant forces every switch to be updated.

export type GameEvent =
  | { t: "game_start"; gameId: string; seed?: string }
  | { t: "game_complete"; gameId: string; score: number; durationMs?: number; flags: string[] }
  | { t: "replay_attempt"; gameId: string }
  | { t: "share_click"; gameId: string }
  | { t: "optin_submit"; gameId: string; channel: "email" | "sms" }
  | { t: "issue_clickthrough"; gameId: string }
  | { t: "score_rejected"; gameId: string; reason: "replay_mismatch" | "ceiling" };

export type EmitFn = (event: GameEvent) => void;

/** A no-op emitter — the safe default when no analytics sink is configured. */
export const noopEmit: EmitFn = () => {};

/** Build an emitter that fans an event out to one or more sinks, swallowing sink errors. */
export function createEmitter(...sinks: EmitFn[]): EmitFn {
  return (event) => {
    for (const sink of sinks) {
      try {
        sink(event);
      } catch {
        /* telemetry must never break gameplay */
      }
    }
  };
}
