import type { Game, ScoreBreakdown } from "@/lib/games/engine";
import type { DocketConfig, Dir } from "./config.schema";
import { parseMaze, isOpen, stepCell, cellKey, dist2, opposite, DELTA, type Cell, type ParsedMaze } from "./maze";

// The Docket (Children First) — Pac-Man-style maze chase. PHASE 2: four ghosts with
// distinct deterministic chase AI + power-pellet "Reform" mode (frightened/edible
// ghosts) + difficulty tuning (staggered release, spawn grace, catchable speed). Still
// fully deterministic — frightened ghosts FLEE (maximize distance), no RNG enters the
// sim, so client + server replays match exactly.
//
// Framing (locked): the antagonist is the SYSTEM, never a profession. The four ghosts
// are System mechanisms (Delay / Red Tape / Sealed File / Conflict) with different
// pursuit styles.

export const THE_DOCKET_ID = "the-docket";

const TIE_ORDER: Dir[] = ["up", "left", "down", "right"]; // equidistant tie-break (classic)

// Distinct pursuit styles, assigned to ghosts in maze order.
export type Personality = "delay" | "redtape" | "sealed" | "conflict";
const PERSONALITIES: Personality[] = ["delay", "redtape", "sealed", "conflict"];
// 90°-rotated offset used by the "flank" ghost.
const PERP: Record<Dir, Cell> = {
  up: { col: -1, row: 0 }, down: { col: 1, row: 0 }, left: { col: 0, row: 1 }, right: { col: 0, row: -1 },
};

export interface Mover {
  col: number;
  row: number;
  dir: Dir | null;
  queuedDir: Dir | null;
}
export interface Ghost {
  col: number;
  row: number;
  dir: Dir | null;
  frightened: boolean;
  eaten: boolean; // sent home + inert for the rest of the power window (can't catch or be re-eaten)
}

export interface DocketState {
  tick: number;
  player: Mover;
  ghosts: Ghost[];
  pellets: Set<string>;
  powerPellets: Set<string>;
  pelletsTotal: number;
  pelletsEaten: number;
  powerTicksLeft: number;
  ghostChain: number; // frightened ghosts eaten in the current power window
  graceLeft: number; // no chase-catch while > 0
  releaseBaseTick: number; // ghost i activates at this + i*ghostReleaseTicks
  lives: number;
  caughtCount: number;
  ghostsEaten: number;
  score: number;
  cleared: boolean;
  lastEvent: "eat" | "power" | "eat-ghost" | "caught" | "clear" | null;
}

export type DocketInput = { kind: "turn"; dir: Dir };

const samecell = (a: { col: number; row: number }, b: { col: number; row: number }) => a.col === b.col && a.row === b.row;
const aheadOf = (p: Mover, n: number): Cell => (p.dir ? { col: p.col + DELTA[p.dir].col * n, row: p.row + DELTA[p.dir].row * n } : { col: p.col, row: p.row });

function targetFor(kind: Personality, p: Mover, ghost: Ghost, home: Cell): Cell {
  switch (kind) {
    case "delay": // direct chase
      return { col: p.col, row: p.row };
    case "redtape": // ambush 4 cells ahead
      return aheadOf(p, 4);
    case "sealed": { // flank: 4 ahead + 2 to the side
      const a = aheadOf(p, 4);
      const perp = p.dir ? PERP[p.dir] : { col: 0, row: 0 };
      return { col: a.col + perp.col * 2, row: a.row + perp.row * 2 };
    }
    case "conflict": // shy: chase when far, retreat home when within ~8 cells
      return dist2(ghost, p) > 64 ? { col: p.col, row: p.row } : { col: home.col, row: home.row };
  }
}

// Choose a ghost's next direction: among open, non-reversing moves, the one minimizing
// `score(nextCell)` (TIE_ORDER breaks ties). Chase passes target-distance; flee passes
// the negated player-distance.
function pickDir(g: Ghost, maze: ParsedMaze, score: (next: Cell) => number): Dir | null {
  const back = g.dir ? opposite[g.dir] : null;
  let cands = TIE_ORDER.filter((d) => d !== back && isOpen(maze, stepCell(g, d).col, stepCell(g, d).row));
  if (cands.length === 0) cands = TIE_ORDER.filter((d) => isOpen(maze, stepCell(g, d).col, stepCell(g, d).row)); // dead end → reverse
  if (cands.length === 0) return null; // fully boxed in → stay put
  let best = cands[0];
  let bestScore = score(stepCell(g, best));
  for (const d of cands) {
    const sc = score(stepCell(g, d));
    if (sc < bestScore) {
      best = d;
      bestScore = sc;
    }
  }
  return best;
}

function eatPelletAt(s: DocketState, col: number, row: number, cfg: DocketConfig): void {
  const k = cellKey(col, row);
  if (s.pellets.has(k)) {
    s.pellets = new Set(s.pellets);
    s.pellets.delete(k);
    s.pelletsEaten += 1;
    s.score += cfg.scoring.pelletValue;
    s.lastEvent = "eat";
  } else if (s.powerPellets.has(k)) {
    s.powerPellets = new Set(s.powerPellets);
    s.powerPellets.delete(k);
    s.score += cfg.scoring.powerValue;
    s.powerTicksLeft = cfg.powerDurationTicks;
    s.ghostChain = 0;
    s.lastEvent = "power";
    for (const g of s.ghosts) g.frightened = true; // a Reform turns the system frightened
  }
}

function movePlayer(s: DocketState, maze: ParsedMaze, cfg: DocketConfig): void {
  const p = s.player;
  if (p.queuedDir) {
    const q = stepCell(p, p.queuedDir);
    if (isOpen(maze, q.col, q.row)) {
      p.dir = p.queuedDir;
      p.queuedDir = null;
    }
  }
  if (p.dir) {
    const n = stepCell(p, p.dir);
    if (isOpen(maze, n.col, n.row)) {
      p.col = n.col;
      p.row = n.row;
      eatPelletAt(s, p.col, p.row, cfg);
    }
  }
}

const released = (s: DocketState, i: number, cfg: DocketConfig) => s.tick - s.releaseBaseTick >= i * cfg.ghostReleaseTicks;

function resetAfterCatch(s: DocketState, maze: ParsedMaze, cfg: DocketConfig): void {
  s.lives -= 1;
  s.caughtCount += 1;
  s.lastEvent = "caught";
  s.player = { col: maze.playerStart.col, row: maze.playerStart.row, dir: null, queuedDir: null };
  s.ghosts = maze.ghostStarts.map((g) => ({ col: g.col, row: g.row, dir: null, frightened: false, eaten: false }));
  s.powerTicksLeft = 0;
  s.ghostChain = 0;
  s.graceLeft = cfg.spawnGraceTicks;
  s.releaseBaseTick = s.tick;
}

export function scoreCeiling(cfg: DocketConfig): number {
  const flat = cfg.maze.join("");
  const pellets = flat.split(".").length - 1;
  const powers = flat.split("o").length - 1;
  const ghostEatMax = powers * 15 * cfg.scoring.ghostBaseValue; // up to 4/window, chain 2^0..2^3 = 15
  return pellets * cfg.scoring.pelletValue + powers * cfg.scoring.powerValue + cfg.scoring.clearBonus + ghostEatMax;
}

export function makeTheDocket(cfg: DocketConfig): Game<DocketState, DocketInput, DocketConfig> {
  const maze = parseMaze(cfg.maze);

  return {
    id: THE_DOCKET_ID,

    init(): DocketState {
      return {
        tick: 0,
        player: { col: maze.playerStart.col, row: maze.playerStart.row, dir: null, queuedDir: null },
        ghosts: maze.ghostStarts.map((g) => ({ col: g.col, row: g.row, dir: null, frightened: false, eaten: false })),
        pellets: new Set(maze.pellets),
        powerPellets: new Set(maze.powerPellets),
        pelletsTotal: maze.pellets.size,
        pelletsEaten: 0,
        powerTicksLeft: 0,
        ghostChain: 0,
        graceLeft: cfg.spawnGraceTicks,
        releaseBaseTick: 0,
        lives: cfg.startLives,
        caughtCount: 0,
        ghostsEaten: 0,
        score: 0,
        cleared: false,
        lastEvent: null,
      };
    },

    step(prev, inputs, ctx): DocketState {
      const s: DocketState = {
        ...prev,
        tick: ctx.tick,
        lastEvent: null,
        player: { ...prev.player },
        ghosts: prev.ghosts.map((g) => ({ ...g })),
      };

      for (const input of inputs) if (input.kind === "turn") s.player.queuedDir = input.dir;
      if (s.graceLeft > 0) s.graceLeft -= 1;

      // Power window countdown — when it lapses, every ghost (frightened or sent-home)
      // resumes the chase.
      if (s.powerTicksLeft > 0) {
        s.powerTicksLeft -= 1;
        if (s.powerTicksLeft === 0) {
          for (const g of s.ghosts) {
            g.frightened = false;
            g.eaten = false;
          }
        }
      }

      const prevP = { col: s.player.col, row: s.player.row };
      const prevGhosts = s.ghosts.map((g) => ({ col: g.col, row: g.row }));

      // Movement.
      if (ctx.tick > 0 && ctx.tick % cfg.playerStepTicks === 0) movePlayer(s, maze, cfg);
      if (ctx.tick > 0 && ctx.tick % cfg.ghostStepTicks === 0) {
        s.ghosts.forEach((g, i) => {
          if (!released(s, i, cfg) || g.eaten) return; // still in the house, or sent home
          const dir = g.frightened
            ? pickDir(g, maze, (next) => -dist2(next, s.player)) // flee: maximize distance
            : pickDir(g, maze, (next) => dist2(next, targetFor(PERSONALITIES[i % PERSONALITIES.length], s.player, g, maze.ghostStarts[i])));
          if (!dir) return; // boxed in — stay
          g.dir = dir;
          const n = stepCell(g, dir);
          g.col = n.col;
          g.row = n.row;
        });
      }

      // Collisions (same cell, or a pass-through swap), per released ghost.
      s.ghosts.forEach((g, i) => {
        if (!released(s, i, cfg) || g.eaten) return; // sent-home ghosts can't catch or be re-eaten
        const swapped = samecell(g, prevP) && samecell(prevGhosts[i], s.player);
        if (!samecell(g, s.player) && !swapped) return;
        if (g.frightened) {
          // Eat the (frightened) system mechanism — escalating chain value. It goes home
          // and stays inert until the power window ends (bounded to ≤ one eat per ghost).
          s.score += cfg.scoring.ghostBaseValue * Math.pow(2, s.ghostChain);
          s.ghostChain += 1;
          s.ghostsEaten += 1;
          s.lastEvent = "eat-ghost";
          g.col = maze.ghostStarts[i].col;
          g.row = maze.ghostStarts[i].row;
          g.dir = null;
          g.frightened = false;
          g.eaten = true;
        } else if (s.graceLeft <= 0) {
          resetAfterCatch(s, maze, cfg);
        }
      });

      // Cleared the whole docket (all childhood + all reforms).
      if (!s.cleared && s.pellets.size === 0 && s.powerPellets.size === 0) {
        s.cleared = true;
        s.score += cfg.scoring.clearBonus;
        s.lastEvent = "clear";
      }

      return s;
    },

    isOver(s): boolean {
      return s.cleared || s.lives <= 0 || s.tick >= cfg.roundTicks;
    },

    score(s): ScoreBreakdown {
      const flags: string[] = [];
      if (s.cleared) flags.push("cleared");
      if (s.caughtCount === 0) flags.push("untouched");
      if (s.ghostsEaten > 0) flags.push("pushed_back");
      return {
        total: Math.max(0, Math.round(s.score)),
        components: { childhoodSaved: s.pelletsEaten, lives: s.lives, caught: s.caughtCount, ghostsEaten: s.ghostsEaten },
        flags,
        ceiling: scoreCeiling(cfg),
      };
    },
  };
}

export { PERSONALITIES };
