import type { Game, ScoreBreakdown, StepContext } from "@/lib/games/engine";
import { comboMultiplier, weightedPick } from "@/lib/games/engine";
import type { RedTapeRunConfig, EntityKind } from "./config.schema";

// Red Tape Run (Children First) — a Pitfall-style runner, as a pure reducer. You
// auto-scroll through the family-court process:
//   • JUMP to dodge ABUSE hazards (endless continuance, sealed docket, conflict of
//     interest, …). Hit one → integrity drops; enough hits and the run ends.
//   • stay GROUNDED to grab REFORM tokens (open record, oversight, transparency, …).
// Two-sided constraint = the lesson: you can't be airborne AND grounded, so spam-
// jumping clears every abuse but misses every reform, while never jumping collects
// reforms but the abuses grind you down. Winning = dodge the abuse AND pick up the
// reforms — vigilance plus accountability.
//
// Deterministic: the entity layout is generated once at init from ctx.rng, and physics
// advance per fixed tick. No Math.random / wall-clock.

export const RED_TAPE_RUN_ID = "red-tape-run";

const VARIANT_COUNT = 8; // sub-type spread; the view maps variant → a content label

export interface RunEntity {
  id: string;
  kind: EntityKind;
  variant: number;
  worldPos: number;
}

export type RunOutcome = "clear" | "hit" | "collect" | "miss" | null;

export interface RedTapeRunState {
  tick: number;
  worldX: number;
  y: number;
  vy: number;
  grounded: boolean;
  integrity: number;
  score: number;
  streak: number;
  reformsCollected: number;
  abusesHit: number;
  abusesCleared: number;
  reformsMissed: number;
  nextIdx: number; // entities[< nextIdx] are already resolved (sorted by worldPos)
  lastOutcome: RunOutcome; // for view feedback only
  entities: RunEntity[]; // immutable after init
}

export type RedTapeRunInput = { kind: "jump" };

const LEAD = 90; // world units before the first entity, so the run eases in

function generateEntities(cfg: RedTapeRunConfig, ctx: StepContext): RunEntity[] {
  const kinds: EntityKind[] = ["abuse", "reform"];
  const weights = kinds.map((k) => cfg.items[k]?.weight ?? 0);
  const distance = cfg.roundTicks * cfg.scrollSpeed;
  const entities: RunEntity[] = [];
  let pos = LEAD;
  let i = 0;
  while (pos <= distance + cfg.maxGap && entities.length < 4096) {
    const kind = kinds[weightedPick(ctx.rng, weights)];
    const variant = Math.floor(ctx.rng() * VARIANT_COUNT);
    entities.push({ id: `e${i}`, kind, variant, worldPos: pos });
    i += 1;
    pos += cfg.minGap + ctx.rng() * (cfg.maxGap - cfg.minGap);
  }
  return entities;
}

export function scoreCeiling(cfg: RedTapeRunConfig): number {
  // Loose, config-only upper bound for the server-side clamp (the exact anti-cheat
  // guard is the replay match). Assumes every possible entity resolved at max combo.
  const distance = cfg.roundTicks * cfg.scrollSpeed;
  const maxEntities = Math.floor(distance / cfg.minGap) + 2;
  const maxMult = comboMultiplier(maxEntities * cfg.scoring.combo.stepEvery, cfg.scoring.combo);
  const bestPerEntity = Math.max(cfg.scoring.reformValue, cfg.scoring.clearBonus);
  return Math.round(maxEntities * bestPerEntity * maxMult + cfg.roundTicks * cfg.scoring.survivalPerTick);
}

function scoreState(s: RedTapeRunState, cfg: RedTapeRunConfig): ScoreBreakdown {
  const totalReforms = s.entities.reduce((n, e) => n + (e.kind === "reform" ? 1 : 0), 0);
  const flags: string[] = [];
  if (s.abusesHit === 0) flags.push("unscathed");
  if (s.integrity > 0) flags.push("made_it");
  if (totalReforms > 0 && s.reformsCollected >= Math.ceil(totalReforms * 0.6)) flags.push("reformer");

  return {
    total: Math.max(0, Math.round(s.score)),
    components: {
      reformsCollected: s.reformsCollected,
      abusesCleared: s.abusesCleared,
      abusesHit: s.abusesHit,
      integrity: s.integrity,
    },
    flags,
    ceiling: scoreCeiling(cfg),
  };
}

export function makeRedTapeRun(cfg: RedTapeRunConfig): Game<RedTapeRunState, RedTapeRunInput, RedTapeRunConfig> {
  return {
    id: RED_TAPE_RUN_ID,

    init(_cfg, ctx): RedTapeRunState {
      return {
        tick: 0,
        worldX: 0,
        y: 0,
        vy: 0,
        grounded: true,
        integrity: cfg.integrityStart,
        score: 0,
        streak: 0,
        reformsCollected: 0,
        abusesHit: 0,
        abusesCleared: 0,
        reformsMissed: 0,
        nextIdx: 0,
        lastOutcome: null,
        entities: generateEntities(cfg, ctx),
      };
    },

    step(prev, inputs, ctx): RedTapeRunState {
      const s: RedTapeRunState = { ...prev, tick: ctx.tick, lastOutcome: null };

      // 1. Jump (only from the ground; no double-jump).
      if (s.grounded && inputs.some((i) => i.kind === "jump")) {
        s.vy = cfg.jumpVelocity;
        s.grounded = false;
      }

      // 2. Vertical physics.
      if (!s.grounded) {
        s.vy -= cfg.gravity;
        s.y += s.vy;
        if (s.y <= 0) {
          s.y = 0;
          s.vy = 0;
          s.grounded = true;
        }
      }

      // 3. Scroll.
      s.worldX += cfg.scrollSpeed;

      // 4. Resolve every entity the player has now reached, using the CURRENT height.
      const mult = () => comboMultiplier(s.streak, cfg.scoring.combo);
      while (s.nextIdx < s.entities.length && s.entities[s.nextIdx].worldPos <= s.worldX) {
        const e = s.entities[s.nextIdx];
        if (e.kind === "abuse") {
          if (s.y >= cfg.clearHeight) {
            s.score += Math.round(cfg.scoring.clearBonus * mult());
            s.abusesCleared += 1;
            s.streak += 1;
            s.lastOutcome = "clear";
          } else {
            s.integrity = Math.max(0, s.integrity - cfg.hitDamage);
            s.abusesHit += 1;
            s.streak = 0;
            s.lastOutcome = "hit";
          }
        } else {
          if (s.y <= cfg.grabHeight) {
            s.score += Math.round(cfg.scoring.reformValue * mult());
            s.reformsCollected += 1;
            s.streak += 1;
            s.lastOutcome = "collect";
          } else {
            // missed a reform while airborne — no points, but no streak reset either
            s.reformsMissed += 1;
            if (s.lastOutcome == null) s.lastOutcome = "miss";
          }
        }
        s.nextIdx += 1;
      }

      // 5. Survival reward for staying in the run.
      if (s.integrity > 0) s.score += cfg.scoring.survivalPerTick;

      return s;
    },

    isOver(s): boolean {
      return s.tick >= cfg.roundTicks || s.integrity <= 0;
    },

    score(s): ScoreBreakdown {
      return scoreState(s, cfg);
    },
  };
}
