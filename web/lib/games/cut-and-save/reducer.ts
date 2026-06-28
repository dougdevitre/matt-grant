import type { Game, ScoreBreakdown, StepContext } from "@/lib/games/engine";
import { applyMultiplier, clamp, comboMultiplier, weightedPick } from "@/lib/games/engine";
import type { CutSaveConfig, ItemType } from "./config.schema";

// Cut & Save (Lower Taxes) — the spec's §6.1, as a pure reducer over the engine's
// Game contract. The civic point IS the winning strategy:
//   • cut WASTE      → funds tax relief (good)
//   • cut ESSENTIALS → harms families: relief deducted, families_harmed flag (bad)
//   • cut DECOYS ("audit office") → looks wasteful, but some spending pays for itself,
//                                   so cutting it DROPS your waste yield for a while (bad)
//   • BORROW → instant tax relief that compounds into debt and pushes taxes back UP —
//             the gimmick optimal play ignores ("relief funded by efficiency, not gimmicks").
// Two-sided fail: harm families OR ignore waste (bloat) and you can't post a winning
// score. No Math.random / Date.now here — randomness is only ctx.rng (replayable).
//
// The engine passes config only to init(), but Cut & Save needs its config every tick,
// so this is a CONFIG-BOUND FACTORY: makeCutAndSave(cfg) closes over cfg and returns a
// Game. The app and the score API both build the game the same way, so client render
// and server replay stay identical.

export const CUT_AND_SAVE_ID = "cut-and-save";

export interface BoardItem {
  id: string;
  type: ItemType;
  value: number;
  spawnTick: number;
  expireTick: number;
}

export interface CutSaveState {
  tick: number;
  relief: number;
  debt: number;
  taxPct: number;
  streak: number;
  multiplier: number;
  borrowUsed: number;
  familiesHarmed: number;
  wasteMissed: number; // waste items that expired uncut → bloat (taxes don't fall)
  spawnCount: number; // monotonic; also the next item's id ordinal
  decoyDebuffUntil: number; // tick until which waste yield is reduced
  board: BoardItem[];
}

export type CutSaveInput =
  | { kind: "cut"; id: string }
  | { kind: "skip"; id: string }
  | { kind: "borrow" };

// Effective relief after debt drag — what actually drives taxes down. Debt (from
// borrowing) erodes the relief you earned, so the gimmick is self-defeating.
const effectiveRelief = (s: CutSaveState): number => s.relief - s.debt;

function computeTaxPct(s: CutSaveState, cfg: CutSaveConfig): number {
  const earned = (effectiveRelief(s) / cfg.reliefTarget) * cfg.taxRange;
  return clamp(100 - earned, cfg.taxFloor, 100);
}

function spawnItem(s: CutSaveState, cfg: CutSaveConfig, ctx: StepContext): BoardItem {
  const types: ItemType[] = ["waste", "essential", "decoy"];
  const weights = types.map((t) => cfg.items[t]?.weight ?? 0);
  const type = types[weightedPick(ctx.rng, weights)];
  const spec = cfg.items[type]!;
  const span = spec.maxValue - spec.minValue;
  const value = spec.minValue + Math.floor(ctx.rng() * (span + 1));
  return { id: `i${s.spawnCount}`, type, value, spawnTick: s.tick, expireTick: s.tick + cfg.itemLifeTicks };
}

/** Theoretical max score given the config — used for the server-side ceiling clamp. */
export function scoreCeiling(cfg: CutSaveConfig): number {
  const spawns = Math.floor(cfg.roundTicks / cfg.spawnEveryTicks);
  const maxMult = comboMultiplier(spawns * cfg.combo.stepEvery, cfg.combo);
  const maxWaste = cfg.items.waste?.maxValue ?? 0;
  return Math.round(spawns * maxWaste * maxMult) + cfg.bonuses.noFamilyHarmed + cfg.bonuses.noBorrow;
}

function scoreState(s: CutSaveState, cfg: CutSaveConfig): ScoreBreakdown {
  const flags: string[] = [];
  if (s.familiesHarmed === 0) flags.push("no_family_harmed");
  if (s.borrowUsed === 0) flags.push("no_borrow");
  if (s.wasteMissed === 0) flags.push("no_bloat");

  const harmPenalty = s.familiesHarmed * cfg.essentialHarmPenalty;
  const noHarmBonus = s.familiesHarmed === 0 ? cfg.bonuses.noFamilyHarmed : 0;
  const noBorrowBonus = s.borrowUsed === 0 ? cfg.bonuses.noBorrow : 0;

  const components = {
    relief: s.relief,
    debt: -s.debt,
    harmPenalty: -harmPenalty,
    noFamilyHarmedBonus: noHarmBonus,
    noBorrowBonus: noBorrowBonus,
  };
  const total = Math.max(0, s.relief - s.debt - harmPenalty + noHarmBonus + noBorrowBonus);
  return { total, components, flags, ceiling: scoreCeiling(cfg) };
}

export function makeCutAndSave(cfg: CutSaveConfig): Game<CutSaveState, CutSaveInput, CutSaveConfig> {
  return {
    id: CUT_AND_SAVE_ID,

    init(): CutSaveState {
      const base: CutSaveState = {
        tick: 0,
        relief: 0,
        debt: 0,
        taxPct: 100,
        streak: 0,
        multiplier: 1,
        borrowUsed: 0,
        familiesHarmed: 0,
        wasteMissed: 0,
        spawnCount: 0,
        decoyDebuffUntil: 0,
        board: [],
      };
      base.taxPct = computeTaxPct(base, cfg);
      return base;
    },

    step(prev, inputs, ctx): CutSaveState {
      const s: CutSaveState = { ...prev, tick: ctx.tick };
      let board = [...prev.board];

      // 1. Spawn on the cadence (skip tick 0 so the round opens on an empty board).
      if (ctx.tick > 0 && ctx.tick % cfg.spawnEveryTicks === 0) {
        board.push(spawnItem(s, cfg, ctx));
        s.spawnCount += 1;
      }

      // 2. Resolve player inputs scheduled for this tick.
      for (const input of inputs) {
        if (input.kind === "borrow") {
          s.borrowUsed += 1;
          s.debt += cfg.borrow.debtAdded;
          // instant tax relief is modeled by crediting relief now; debt (above) will
          // compound and overtake it — net negative, the whole point of the gimmick.
          s.relief += Math.round((cfg.borrow.instantTaxRelief / cfg.taxRange) * cfg.reliefTarget);
          continue;
        }
        const idx = board.findIndex((it) => it.id === input.id);
        if (idx < 0) continue; // already gone (expired or double-tapped) — ignore
        const item = board[idx];
        board.splice(idx, 1);
        if (input.kind === "skip") continue; // letting an item pass resolves on expiry rules below
        // kind === "cut"
        if (item.type === "waste") {
          const debuffed = ctx.tick < s.decoyDebuffUntil;
          const yieldFactor = debuffed ? cfg.decoyYieldFactor : 1;
          s.relief += Math.round(applyMultiplier(item.value, s.streak, cfg.combo) * yieldFactor);
          s.streak += 1;
        } else if (item.type === "essential") {
          s.familiesHarmed += 1;
          s.relief = Math.max(0, s.relief - cfg.essentialHarmPenalty);
          s.streak = 0;
        } else {
          // decoy: looked wasteful, but cutting it suppresses future waste yield
          s.decoyDebuffUntil = ctx.tick + cfg.decoyDebuffTicks;
          s.streak = 0;
        }
      }

      // 3. Expire items whose life ran out. Uncut WASTE becomes bloat (taxes stall);
      //    uncut essentials/decoys are the correct "leave it alone" outcome.
      const survivors: BoardItem[] = [];
      for (const it of board) {
        if (ctx.tick >= it.expireTick) {
          if (it.type === "waste") s.wasteMissed += 1;
        } else {
          survivors.push(it);
        }
      }
      board = survivors;

      // 4. Debt compounds on its cadence — borrowing explodes over time.
      if (s.debt > 0 && ctx.tick > 0 && ctx.tick % cfg.borrow.compoundEveryTicks === 0) {
        s.debt = Math.round(s.debt * (1 + cfg.borrow.compoundRate));
      }

      // 5. Derived fields.
      s.multiplier = comboMultiplier(s.streak, cfg.combo);
      s.taxPct = computeTaxPct(s, cfg);
      s.board = board;
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
