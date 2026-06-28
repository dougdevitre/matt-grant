import type { Game, ScoreBreakdown, StepContext } from "@/lib/games/engine";
import { applyMultiplier, clamp, comboMultiplier, weightedPick } from "@/lib/games/engine";
import type { ClarityConfig, RecordType } from "./config.schema";

// Clarity Companion (Children First) — spec §6.4, as a pure reducer. Triage each
// record with the right action:
//   • OPEN          a public-interest record (no child PII)        → +Accountability
//   • PROTECT       a child-identifying record                     → +Child Privacy
//   • REDACT & OPEN a mixed record (public substance + child PII)   → +both (best play)
// Wrong action crashes the relevant meter and resets the streak. The lesson is the
// two-sided constraint: seal too much → Accountability collapses; expose a kid →
// Child Privacy collapses. You must keep BOTH above the floor — they coexist.
// No Math.random / wall-clock — randomness only from ctx.rng (replayable).

export const CLARITY_ID = "clarity-companion";

export type ClarityAction = "open" | "protect" | "redact";

export interface RecordCard {
  id: string;
  type: RecordType;
  spawnTick: number;
  expireTick: number;
}

export interface ClarityState {
  tick: number;
  accountability: number;
  childPrivacy: number;
  streak: number;
  correctCount: number;
  childExposures: number; // times a child's record was exposed (wrong open/redact)
  overSeals: number; // times a public record was sealed (wrong protect)
  missed: number;
  spawnCount: number;
  queue: RecordCard[];
}

export type ClarityInput = { kind: ClarityAction; id: string };

function drawCard(s: ClarityState, cfg: ClarityConfig, ctx: StepContext): RecordCard {
  const types: RecordType[] = ["public", "child", "mixed"];
  const weights = types.map((t) => cfg.items[t]?.weight ?? 0);
  const type = types[weightedPick(ctx.rng, weights)];
  return { id: `r${s.spawnCount}`, type, spawnTick: s.tick, expireTick: s.tick + cfg.cardLifeTicks };
}

const up = (v: number, by: number) => clamp(v + by, 0, 100);
const down = (v: number, by: number) => clamp(v - by, 0, 100);

function resolve(s: ClarityState, type: RecordType, action: ClarityAction, cfg: ClarityConfig): void {
  // The matrix that encodes the lesson. Correct → meter(s) up + streak; wrong → crash + reset.
  if (action === "open") {
    if (type === "public") {
      s.accountability = up(s.accountability, cfg.correctGain);
      s.streak += 1;
      s.correctCount += 1;
    } else {
      // opened a child / mixed record without masking → exposed a kid
      s.childPrivacy = down(s.childPrivacy, cfg.exposeCrash);
      s.childExposures += 1;
      s.streak = 0;
    }
    return;
  }
  if (action === "protect") {
    if (type === "child") {
      s.childPrivacy = up(s.childPrivacy, cfg.correctGain);
      s.streak += 1;
      s.correctCount += 1;
    } else {
      // sealed a public-interest record (or the public substance of a mixed one)
      s.accountability = down(s.accountability, cfg.sealCrash);
      s.overSeals += 1;
      s.streak = 0;
    }
    return;
  }
  // redact & open
  if (type === "mixed") {
    s.accountability = up(s.accountability, cfg.correctGain);
    s.childPrivacy = up(s.childPrivacy, cfg.correctGain);
    s.streak += 1;
    s.correctCount += 1;
  } else if (type === "public") {
    // harmless but unnecessary — still opens the substance, small credit, no crash
    s.accountability = up(s.accountability, Math.ceil(cfg.correctGain / 2));
    s.streak += 1;
    s.correctCount += 1;
  } else {
    // redacting a pure-child record still surfaces it — minor privacy hit
    s.childPrivacy = down(s.childPrivacy, cfg.minorCrash);
    s.childExposures += 1;
    s.streak = 0;
  }
}

export function scoreCeiling(cfg: ClarityConfig): number {
  const bothMax = 100 * cfg.scoring.minMeterWeight + 200 * cfg.scoring.sumMeterWeight;
  const spawns = Math.floor(cfg.roundTicks / cfg.spawnEveryTicks) + 1;
  const maxMult = comboMultiplier(spawns * cfg.scoring.combo.stepEvery, cfg.scoring.combo);
  const comboMax = applyMultiplier(spawns * cfg.scoring.correctBonus, spawns * cfg.scoring.combo.stepEvery, cfg.scoring.combo);
  return Math.round(bothMax + comboMax) + Math.round(maxMult); // generous, finite backstop
}

function scoreState(s: ClarityState, cfg: ClarityConfig): ScoreBreakdown {
  const weaker = Math.min(s.accountability, s.childPrivacy);
  const meterScore = weaker * cfg.scoring.minMeterWeight + (s.accountability + s.childPrivacy) * cfg.scoring.sumMeterWeight;
  const comboScore = applyMultiplier(s.correctCount * cfg.scoring.correctBonus, s.streak, cfg.scoring.combo);

  const flags: string[] = [];
  const bothUp = s.accountability >= cfg.meterFloor && s.childPrivacy >= cfg.meterFloor;
  if (bothUp) flags.push("both_upheld");
  if (s.childExposures === 0) flags.push("no_child_exposed");
  if (s.overSeals === 0) flags.push("nothing_over_sealed");
  if (!bothUp) flags.push("balance_broken");

  // Failing the both/and constraint forfeits the combo reward — you can't buy your
  // way out of collapsing a meter.
  const total = bothUp ? Math.max(0, meterScore + comboScore) : Math.max(0, meterScore);
  return {
    total,
    components: { meterScore, comboScore, accountability: s.accountability, childPrivacy: s.childPrivacy },
    flags,
    ceiling: scoreCeiling(cfg),
  };
}

export function makeClarityCompanion(cfg: ClarityConfig): Game<ClarityState, ClarityInput, ClarityConfig> {
  return {
    id: CLARITY_ID,

    init(): ClarityState {
      return {
        tick: 0,
        accountability: cfg.meterStart,
        childPrivacy: cfg.meterStart,
        streak: 0,
        correctCount: 0,
        childExposures: 0,
        overSeals: 0,
        missed: 0,
        spawnCount: 0,
        queue: [],
      };
    },

    step(prev, inputs, ctx): ClarityState {
      const s: ClarityState = { ...prev, tick: ctx.tick };
      let queue = [...prev.queue];

      // 1. Spawn a record on the cadence.
      if (ctx.tick > 0 && ctx.tick % cfg.spawnEveryTicks === 0) {
        queue.push(drawCard(s, cfg, ctx));
        s.spawnCount += 1;
      }

      // 2. Resolve player actions.
      for (const input of inputs) {
        const idx = queue.findIndex((c) => c.id === input.id);
        if (idx < 0) continue;
        const card = queue[idx];
        queue.splice(idx, 1);
        resolve(s, card.type, input.kind, cfg);
      }

      // 3. Expire un-handled records — a miss resets the streak (less bad than a wrong call).
      const survivors: RecordCard[] = [];
      for (const c of queue) {
        if (ctx.tick >= c.expireTick) {
          s.missed += 1;
          s.streak = 0;
        } else {
          survivors.push(c);
        }
      }
      s.queue = survivors;
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
