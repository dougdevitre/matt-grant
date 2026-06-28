import type { Game, ScoreBreakdown, StepContext } from "@/lib/games/engine";
import { clamp, weightedPick } from "@/lib/games/engine";
import type { OrgChartConfig, BlockType } from "./config.schema";

// Org Chart (Smaller Government) — spec §6.2, as a pure reducer. The lesson is the
// TARGET BAND: "right-size, don't gut" is the only winning path.
//   • cut REDUNDANT / BLOAT → shrinks headcount toward the band (good)
//   • cut PROTECTED (veterans/kids/families) or CRITICAL (infra) → service collapses (bad)
//   • never cut enough → headcount stays above the band → bloat wins (bad)
//   • cut below the band → overcut / gutted (bad)
// Two-sided fail: gut service (ends the round) OR fail to right-size (low score).
// Tools: Hiring Freeze (pause spawns) and Early Retirement (clear bloat, spare people).
// No Math.random / wall-clock — randomness only from ctx.rng (replayable).

export const ORG_CHART_ID = "org-chart";

export interface OrgBlock {
  id: string;
  type: BlockType;
  spawnTick: number;
}

export interface OrgChartState {
  tick: number;
  headcount: number; // === board.length, kept explicit for the HUD/score
  serviceLevel: number;
  spawnPausedUntil: number; // hiring freeze active while tick < this
  freezeReadyAt: number; // freeze usable again once tick >= this
  retireUsed: number;
  ticksInBand: number;
  protectedCut: number;
  criticalCut: number;
  spawnCount: number;
  board: OrgBlock[];
}

export type OrgChartInput =
  | { kind: "cut"; id: string }
  | { kind: "freeze" }
  | { kind: "retire" };

const TYPES: BlockType[] = ["redundant", "bloat", "protected", "critical"];
const isCuttableBloat = (t: BlockType) => t === "redundant" || t === "bloat";

function drawBlock(s: OrgChartState, cfg: OrgChartConfig, ctx: StepContext): OrgBlock {
  const weights = TYPES.map((t) => cfg.items[t]?.weight ?? 0);
  const type = TYPES[weightedPick(ctx.rng, weights)];
  return { id: `b${s.spawnCount}`, type, spawnTick: s.tick };
}

const inBand = (headcount: number, cfg: OrgChartConfig) =>
  headcount >= cfg.targetBand[0] && headcount <= cfg.targetBand[1];

export function scoreCeiling(cfg: OrgChartConfig): number {
  return (
    cfg.scoring.bandBase +
    cfg.serviceStart * cfg.scoring.servicePerPoint +
    cfg.roundTicks * cfg.scoring.efficiencyPerTickInBand
  );
}

function scoreState(s: OrgChartState, cfg: OrgChartConfig): ScoreBreakdown {
  const [min, max] = cfg.targetBand;
  const within = inBand(s.headcount, cfg);
  const distance = within ? 0 : s.headcount > max ? s.headcount - max : min - s.headcount;

  const bandScore = Math.max(0, cfg.scoring.bandBase - distance * cfg.scoring.outOfBandPenalty);
  const serviceScore = s.serviceLevel * cfg.scoring.servicePerPoint;
  const efficiency = s.ticksInBand * cfg.scoring.efficiencyPerTickInBand;

  const flags: string[] = [];
  if (within) flags.push("right_sized");
  if (s.protectedCut === 0 && s.criticalCut === 0) flags.push("service_intact");
  if (s.serviceLevel < cfg.serviceFloor) flags.push("service_collapsed");
  if (s.headcount > max) flags.push("bloat_wins");
  if (s.headcount < min) flags.push("overcut");

  const collapsed = s.serviceLevel < cfg.serviceFloor;
  const total = collapsed
    ? Math.max(0, serviceScore) // gutting service forfeits the band/efficiency reward
    : Math.max(0, bandScore + serviceScore + efficiency);

  return {
    total,
    components: { bandScore, serviceScore, efficiency },
    flags,
    ceiling: scoreCeiling(cfg),
  };
}

export function makeOrgChart(cfg: OrgChartConfig): Game<OrgChartState, OrgChartInput, OrgChartConfig> {
  return {
    id: ORG_CHART_ID,

    init(_cfg, ctx): OrgChartState {
      const s: OrgChartState = {
        tick: 0,
        headcount: 0,
        serviceLevel: cfg.serviceStart,
        spawnPausedUntil: 0,
        freezeReadyAt: 0,
        retireUsed: 0,
        ticksInBand: 0,
        protectedCut: 0,
        criticalCut: 0,
        spawnCount: 0,
        board: [],
      };
      // Seed the opening board so the round starts mid-reorg (usually above band).
      for (let i = 0; i < cfg.initialBlocks; i++) {
        s.board.push(drawBlock(s, cfg, ctx));
        s.spawnCount += 1;
      }
      s.headcount = s.board.length;
      return s;
    },

    step(prev, inputs, ctx): OrgChartState {
      const s: OrgChartState = { ...prev, tick: ctx.tick };
      let board = [...prev.board];

      // 1. Spawn unless a hiring freeze is active.
      if (ctx.tick > 0 && ctx.tick % cfg.spawnEveryTicks === 0 && ctx.tick >= s.spawnPausedUntil) {
        board.push(drawBlock(s, cfg, ctx));
        s.spawnCount += 1;
      }

      // 2. Inputs.
      for (const input of inputs) {
        if (input.kind === "freeze") {
          if (ctx.tick >= s.freezeReadyAt) {
            s.spawnPausedUntil = ctx.tick + cfg.freezeTicks;
            s.freezeReadyAt = ctx.tick + cfg.freezeCooldownTicks;
          }
          continue;
        }
        if (input.kind === "retire") {
          if (s.retireUsed < cfg.retireMaxUses) {
            let cleared = 0;
            board = board.filter((b) => {
              if (cleared < cfg.retireClears && isCuttableBloat(b.type)) {
                cleared += 1;
                return false; // retire this bloat/redundant block
              }
              return true; // spare protected/critical and anything past the limit
            });
            s.retireUsed += 1;
          }
          continue;
        }
        // cut by id
        const idx = board.findIndex((b) => b.id === input.id);
        if (idx < 0) continue;
        const block = board[idx];
        board.splice(idx, 1);
        if (block.type === "protected") {
          s.protectedCut += 1;
          s.serviceLevel = clamp(s.serviceLevel - cfg.protectedPenalty, 0, 100);
        } else if (block.type === "critical") {
          s.criticalCut += 1;
          s.serviceLevel = clamp(s.serviceLevel - cfg.criticalPenalty, 0, 100);
        }
      }

      // 3. Derived.
      s.headcount = board.length;
      if (inBand(s.headcount, cfg)) s.ticksInBand += 1;
      s.board = board;
      return s;
    },

    isOver(s): boolean {
      return s.tick >= cfg.roundTicks || s.serviceLevel < cfg.serviceFloor;
    },

    score(s): ScoreBreakdown {
      return scoreState(s, cfg);
    },
  };
}
