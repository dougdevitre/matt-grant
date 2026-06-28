import type { Dir } from "./config.schema";

// Pure maze helpers: parse the ASCII maze once, and the grid math the reducer + ghost
// AI use. No state, no randomness — keeps movement fully deterministic.

export interface Cell {
  col: number;
  row: number;
}

export interface ParsedMaze {
  width: number;
  height: number;
  /** walls[row][col] === true where a wall blocks movement */
  walls: boolean[][];
  /** remaining-pellet cell keys ("col,row"); the reducer clones + shrinks this */
  pellets: Set<string>;
  playerStart: Cell;
  ghostStart: Cell;
}

export const cellKey = (col: number, row: number): string => `${col},${row}`;

export const DELTA: Record<Dir, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

export const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export function parseMaze(rows: string[]): ParsedMaze {
  const height = rows.length;
  const width = rows[0].length;
  const walls: boolean[][] = [];
  const pellets = new Set<string>();
  let playerStart: Cell = { col: 1, row: 1 };
  let ghostStart: Cell = { col: 1, row: 1 };

  for (let row = 0; row < height; row++) {
    walls[row] = [];
    for (let col = 0; col < width; col++) {
      const ch = rows[row][col];
      walls[row][col] = ch === "#";
      if (ch === ".") pellets.add(cellKey(col, row));
      else if (ch === "P") playerStart = { col, row };
      else if (ch === "G") ghostStart = { col, row };
    }
  }
  return { width, height, walls, pellets, playerStart, ghostStart };
}

/** True if (col,row) is inside the grid and not a wall. */
export function isOpen(maze: ParsedMaze, col: number, row: number): boolean {
  if (row < 0 || row >= maze.height || col < 0 || col >= maze.width) return false;
  return !maze.walls[row][col];
}

export const stepCell = (cell: Cell, dir: Dir): Cell => ({ col: cell.col + DELTA[dir].col, row: cell.row + DELTA[dir].row });

/** Squared distance — cheaper than sqrt and fine for nearest-target comparisons. */
export const dist2 = (a: Cell, b: Cell): number => (a.col - b.col) ** 2 + (a.row - b.row) ** 2;
