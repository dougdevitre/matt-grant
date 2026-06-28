import type { Game, ScoreBreakdown, StepContext } from "@/lib/games/engine";
import { comboMultiplier } from "@/lib/games/engine";
import type { RotationConfig } from "./config.schema";

// Rotation (Term Limits) — spec §6.3, as a pure reducer. The effectiveness curve is
// the issue's argument made playable:
//   ramp → plateau (the SERVICE SWEET SPOT) → decay (entrenchment) past the cap.
// Rotate a seat in the window [cap-delta, cap] = clean (capture peak, build the
// multiplier). Rotate too EARLY = churn (you threw away the ramp). Rotate too LATE =
// careerism (decayed effectiveness + penalty). Grandfathered incumbents are exempt
// from the early penalty and expire naturally — the cap applies going forward.
// No Math.random / wall-clock — randomness only from ctx.rng at init (replayable).

export const ROTATION_ID = "rotation";

export type SeatStatus = "ramping" | "ready" | "entrenched";

export interface Seat {
  id: string;
  serviceTicks: number;
  grandfathered: boolean;
}

export interface RotationState {
  tick: number;
  seats: Seat[];
  captured: number; // sum of effectiveness captured on rotations + natural expiries
  rotationsClean: number;
  earlyRotations: number;
  lateRotations: number;
  churnTotal: number;
  entrenchTotal: number;
}

export type RotationInput = { kind: "rotate"; seatId: string };

const rampEnd = (cfg: RotationConfig) => cfg.capTicks - cfg.windowDelta;

/** Effectiveness as a function of service length: ramp → plateau → decay. Pure. */
export function effectiveness(serviceTicks: number, cfg: RotationConfig): number {
  if (serviceTicks <= 0) return 0;
  const end = rampEnd(cfg);
  if (serviceTicks < end) return Math.round(cfg.peakEffectiveness * (serviceTicks / end));
  if (serviceTicks <= cfg.capTicks) return cfg.peakEffectiveness; // plateau = sweet spot
  return Math.max(0, Math.round(cfg.peakEffectiveness - cfg.decayPerTick * (serviceTicks - cfg.capTicks)));
}

export function seatStatus(serviceTicks: number, cfg: RotationConfig): SeatStatus {
  if (serviceTicks < rampEnd(cfg)) return "ramping";
  if (serviceTicks <= cfg.capTicks) return "ready";
  return "entrenched";
}

export function scoreCeiling(cfg: RotationConfig): number {
  const maxMult = comboMultiplier(cfg.maxCleanSteps * 1, { stepEvery: 1, stepValue: cfg.cleanBonus, maxSteps: cfg.maxCleanSteps });
  const rotationsPerSeat = Math.ceil(cfg.roundTicks / Math.max(1, rampEnd(cfg))) + 1;
  const captureMax = cfg.seatCount * rotationsPerSeat * cfg.peakEffectiveness;
  const finalMax = cfg.seatCount * cfg.peakEffectiveness;
  return Math.round(captureMax * maxMult + finalMax);
}

function multiplier(rotationsClean: number, cfg: RotationConfig): number {
  return comboMultiplier(rotationsClean, { stepEvery: 1, stepValue: cfg.cleanBonus, maxSteps: cfg.maxCleanSteps });
}

function scoreState(s: RotationState, cfg: RotationConfig): ScoreBreakdown {
  const finalSnapshot = s.seats.reduce((sum, seat) => sum + effectiveness(seat.serviceTicks, cfg), 0);
  const mult = multiplier(s.rotationsClean, cfg);
  const total = Math.max(0, Math.round(s.captured * mult + finalSnapshot - s.churnTotal - s.entrenchTotal));

  const flags: string[] = [];
  if (s.lateRotations === 0) flags.push("no_careerism");
  if (s.earlyRotations === 0) flags.push("no_churn");
  if (s.rotationsClean >= cfg.seatCount) flags.push("served_the_sweet_spot");

  return {
    total,
    components: {
      captured: s.captured,
      capturedWithMultiplier: Math.round(s.captured * mult),
      finalSnapshot,
      churnPenalty: -s.churnTotal,
      entrenchmentPenalty: -s.entrenchTotal,
    },
    flags,
    ceiling: scoreCeiling(cfg),
  };
}

export function makeRotation(cfg: RotationConfig): Game<RotationState, RotationInput, RotationConfig> {
  return {
    id: ROTATION_ID,

    init(_cfg, ctx): RotationState {
      const seats: Seat[] = [];
      for (let i = 0; i < cfg.seatCount; i++) {
        const grandfathered = i < cfg.grandfatheredCount;
        // Stagger opening service lengths (seeded) so seats reach the window at
        // different times — the player always has something to rotate. Grandfathered
        // incumbents open further along their natural term.
        const span = grandfathered ? cfg.grandfatherNaturalTerm : cfg.capTicks;
        const serviceTicks = Math.floor(ctx.rng() * span);
        seats.push({ id: `s${i}`, serviceTicks, grandfathered });
      }
      return {
        tick: 0,
        seats,
        captured: 0,
        rotationsClean: 0,
        earlyRotations: 0,
        lateRotations: 0,
        churnTotal: 0,
        entrenchTotal: 0,
      };
    },

    step(prev, inputs, ctx): RotationState {
      const s: RotationState = { ...prev, tick: ctx.tick, seats: prev.seats.map((seat) => ({ ...seat })) };

      // 1. Age every seat one tick.
      for (const seat of s.seats) seat.serviceTicks += 1;

      // 2. Grandfathered members whose natural term ended retire on their own —
      //    capture their effectiveness, no penalty, counts as a clean turnover.
      for (const seat of s.seats) {
        if (seat.grandfathered && seat.serviceTicks >= cfg.grandfatherNaturalTerm) {
          s.captured += effectiveness(seat.serviceTicks, cfg);
          s.rotationsClean += 1;
          seat.serviceTicks = 0;
          seat.grandfathered = false;
        }
      }

      // 3. Player rotations.
      for (const input of inputs) {
        const seat = s.seats.find((x) => x.id === input.seatId);
        if (!seat) continue;
        s.captured += effectiveness(seat.serviceTicks, cfg);
        if (seat.grandfathered) {
          // Exempt from the early penalty; rotating an incumbent is a clean handoff.
          s.rotationsClean += 1;
        } else if (seat.serviceTicks < rampEnd(cfg)) {
          s.churnTotal += cfg.churnPenalty; // too early — ramp investment wasted
          s.earlyRotations += 1;
        } else if (seat.serviceTicks <= cfg.capTicks) {
          s.rotationsClean += 1; // the service sweet spot
        } else {
          s.entrenchTotal += cfg.entrenchmentPenalty; // too late — careerism
          s.lateRotations += 1;
        }
        seat.serviceTicks = 0;
        seat.grandfathered = false;
      }

      return s;
    },

    isOver(s): boolean {
      return s.tick >= cfg.roundTicks;
    },

    score(s): ScoreBreakdown {
      return scoreState(s, cfg);
    },
  };
}
