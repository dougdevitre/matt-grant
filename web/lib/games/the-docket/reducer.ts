import type { Game, ScoreBreakdown } from "@/lib/games/engine";
import type { DocketConfig, Dir } from "./config.schema";
import { parseMaze, isOpen, stepCell, cellKey, dist2, opposite, type Cell, type ParsedMaze } from "./maze";

// The Docket (Children First) — a Pac-Man-style maze chase, PHASE 1: one maze, one
// ghost. You're an advocate collecting a child's childhood (pellets) before the
// System's mechanism (the ghost) catches you. Pure, grid-locked, tick-stepped
// movement + a DETERMINISTIC ghost chase (classic nearest-cell targeting with a fixed
// tie-break order) → no randomness, so the run replays exactly on client and server.
//
// Reframed concept (locked): the antagonist is the SYSTEM, never a profession.

export const THE_DOCKET_ID = "the-docket";

// Ghost tie-break priority — when two moves are equidistant from the target, the
// earlier one wins (classic Pac-Man uses up > left > down > right).
const TIE_ORDER: Dir[] = ["up", "left", "down", "right"];

export interface Mover {
  col: number;
  row: number;
  dir: Dir | null;
  queuedDir: Dir | null;
}

export interface DocketState {
  tick: number;
  player: Mover;
  ghost: { col: number; row: number; dir: Dir | null };
  pellets: Set<string>; // remaining childhood
  pelletsTotal: number;
  pelletsEaten: number;
  lives: number;
  caughtCount: number;
  score: number;
  cleared: boolean;
  lastEvent: "eat" | "caught" | "clear" | null; // view feedback only
}

export type DocketInput = { kind: "turn"; dir: Dir };

function eatAt(s: DocketState, col: number, row: number, cfg: DocketConfig): void {
  const k = cellKey(col, row);
  if (s.pellets.has(k)) {
    s.pellets = new Set(s.pellets);
    s.pellets.delete(k);
    s.pelletsEaten += 1;
    s.score += cfg.scoring.pelletValue;
    s.lastEvent = "eat";
  }
}

function movePlayer(s: DocketState, maze: ParsedMaze, cfg: DocketConfig): void {
  const p = s.player;
  // Honor a queued turn the moment it's possible (corner pre-turn, classic feel).
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
      eatAt(s, p.col, p.row, cfg);
    }
    // blocked → stay put, keep facing dir so a later turn applies
  }
}

function moveGhost(s: DocketState, maze: ParsedMaze): void {
  const g = s.ghost;
  const target: Cell = { col: s.player.col, row: s.player.row };
  const back = g.dir ? opposite[g.dir] : null;
  let cands = TIE_ORDER.filter((d) => d !== back && isOpen(maze, stepCell(g, d).col, stepCell(g, d).row));
  if (cands.length === 0) cands = TIE_ORDER.filter((d) => isOpen(maze, stepCell(g, d).col, stepCell(g, d).row)); // dead end → reverse
  if (cands.length === 0) return; // fully boxed (shouldn't happen on a valid maze)

  let best = cands[0];
  let bestD = dist2(stepCell(g, best), target);
  for (const d of cands) {
    const dd = dist2(stepCell(g, d), target);
    if (dd < bestD) {
      best = d;
      bestD = dd;
    }
  }
  g.dir = best;
  const n = stepCell(g, best);
  g.col = n.col;
  g.row = n.row;
}

function onCaught(s: DocketState, maze: ParsedMaze): void {
  s.lives -= 1;
  s.caughtCount += 1;
  s.lastEvent = "caught";
  s.player = { col: maze.playerStart.col, row: maze.playerStart.row, dir: null, queuedDir: null };
  s.ghost = { col: maze.ghostStart.col, row: maze.ghostStart.row, dir: null };
}

const samecell = (a: { col: number; row: number }, b: { col: number; row: number }) => a.col === b.col && a.row === b.row;

export function scoreCeiling(cfg: DocketConfig): number {
  const pellets = cfg.maze.join("").split(".").length - 1;
  return pellets * cfg.scoring.pelletValue + cfg.scoring.clearBonus;
}

export function makeTheDocket(cfg: DocketConfig): Game<DocketState, DocketInput, DocketConfig> {
  const maze = parseMaze(cfg.maze); // parse once; walls/starts are static across the game

  return {
    id: THE_DOCKET_ID,

    init(): DocketState {
      return {
        tick: 0,
        player: { col: maze.playerStart.col, row: maze.playerStart.row, dir: null, queuedDir: null },
        ghost: { col: maze.ghostStart.col, row: maze.ghostStart.row, dir: null },
        pellets: new Set(maze.pellets),
        pelletsTotal: maze.pellets.size,
        pelletsEaten: 0,
        lives: cfg.startLives,
        caughtCount: 0,
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
        ghost: { ...prev.ghost },
      };

      // 1. Queue the latest turn input.
      for (const input of inputs) if (input.kind === "turn") s.player.queuedDir = input.dir;

      const prevP = { col: s.player.col, row: s.player.row };
      const prevG = { col: s.ghost.col, row: s.ghost.row };

      // 2. Step movers on their own cadences.
      if (ctx.tick > 0 && ctx.tick % cfg.playerStepTicks === 0) movePlayer(s, maze, cfg);
      if (ctx.tick > 0 && ctx.tick % cfg.ghostStepTicks === 0) moveGhost(s, maze);

      // 3. Caught — same cell, OR they swapped cells passing through each other.
      const swapped = samecell(s.player, prevG) && samecell(s.ghost, prevP);
      if (samecell(s.player, s.ghost) || swapped) onCaught(s, maze);

      // 4. Cleared the whole docket.
      if (!s.cleared && s.pellets.size === 0) {
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
      return {
        total: Math.max(0, s.score),
        components: { childhoodSaved: s.pelletsEaten, lives: s.lives, caught: s.caughtCount },
        flags,
        ceiling: scoreCeiling(cfg),
      };
    },
  };
}
