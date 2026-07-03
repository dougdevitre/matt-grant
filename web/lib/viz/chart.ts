// Pure geometry for the in-app demographic charts. Turns a declarative ChartSpec
// (see web/lib/demographics/charts.ts) into positioned SVG "marks" that the
// server-rendered <BarChart> maps 1:1 to <rect>/<text>/<line>. Kept free of React
// and of the data loaders so the layout math is unit-testable in isolation
// (chart.test.ts) and so the color decisions route through the validated palette
// in ./palette.ts rather than stray hex.
//
// Coordinate space is a fixed 720-wide viewBox; height grows with the number of
// rows. The component scales the viewBox to the container width (responsive), so
// all sizes here are in "chart units," not pixels.
import { BRAND, DIVERGING } from "./palette";

// ── Public spec (what a ChartDef.chart() returns) ──
export type BarDatum = {
  /** Category label drawn in the left gutter. */
  label: string;
  /** Numeric value that drives bar length. May be negative (diverging). */
  value: number;
  /** Pre-formatted value shown in the right-hand value column (e.g. "−5.9%"). */
  display: string;
  /** highlight mode only: the one bar to emphasize (brick); others muted. */
  highlight?: boolean;
};

export type BarsSpec = {
  kind: "bars";
  bars: BarDatum[];
  /**
   * field     — every bar the brand field color (default single-series).
   * diverging — color by sign (brick ↔ blue) around a zero baseline.
   * highlight — one bar brick, the rest muted (ranked "where do we sit" charts).
   */
  colorMode: "field" | "diverging" | "highlight";
};

export type GroupedSpec = {
  kind: "grouped";
  series: { name: string; color: string }[];
  groups: { label: string; values: number[] }[];
};

export type ChartSpec = BarsSpec | GroupedSpec;

// ── Marks the renderer consumes ──
export type Mark =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; rx: number }
  | { t: "text"; x: number; y: number; s: string; anchor: "start" | "middle" | "end"; fill: string; size: number; weight: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string };

export type ChartLayout = { width: number; height: number; marks: Mark[] };

const W = 720;
const MUTED = "#B7C0CC"; // de-emphasized bar in highlight mode
const AXIS = BRAND.line;
const LABEL = BRAND.ink;
const VALUE = BRAND.slate;

/** Linear scale d0..d1 → r0..r1 (no clamping; callers pass a domain that spans the data). */
export function linScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  if (d1 === d0) return () => r0; // degenerate domain → pin to range start
  const m = (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * m;
}

function barColor(mode: BarsSpec["colorMode"], d: BarDatum): string {
  if (mode === "diverging") return d.value < 0 ? DIVERGING.negative : d.value > 0 ? DIVERGING.positive : DIVERGING.neutral;
  if (mode === "highlight") return d.highlight ? BRAND.brick : MUTED;
  return BRAND.field;
}

/**
 * Horizontal bar layout. All-positive data anchors bars at the left axis; data
 * that crosses zero draws a zero baseline and grows bars out from it in both
 * directions. Category labels sit in a left gutter; formatted values in a fixed
 * right column so they never collide with the bars.
 */
export function layoutBars(spec: BarsSpec, opts: { labelGutter?: number } = {}): ChartLayout {
  const gutter = opts.labelGutter ?? 150;
  const valueCol = 56;
  const rowH = 22;
  const gap = 14;
  const padY = 10;
  const plotLeft = gutter;
  const plotRight = W - valueCol;

  const values = spec.bars.map((b) => b.value);
  const height = padY * 2 + spec.bars.length * rowH + (spec.bars.length - 1) * gap;
  const marks: Mark[] = [];

  // Only draw an interior zero baseline when the data actually crosses zero. For a
  // single-sign set (e.g. two counties both declining), pinning "0" to a plot edge
  // and growing bars the full width from it exaggerates small values and wastes the
  // diverging layout — so anchor those at the left axis and scale by magnitude, the
  // same form the ranked charts use.
  const crossesZero = values.some((v) => v < 0) && values.some((v) => v > 0);

  let barGeom: (v: number) => { left: number; w: number };
  if (crossesZero) {
    const x = linScale(Math.min(...values), Math.max(...values), plotLeft, plotRight);
    const zeroX = x(0);
    marks.push({ t: "line", x1: zeroX, y1: padY - 4, x2: zeroX, y2: height - padY + 4, stroke: AXIS });
    barGeom = (v) => {
      const bx = x(v);
      return { left: Math.min(zeroX, bx), w: Math.max(2, Math.abs(bx - zeroX)) };
    };
  } else {
    // Left-anchored magnitude bars; the left axis is the baseline.
    const maxMag = Math.max(1, ...values.map((v) => Math.abs(v)));
    const mag = linScale(0, maxMag, plotLeft, plotRight);
    marks.push({ t: "line", x1: plotLeft, y1: padY - 4, x2: plotLeft, y2: height - padY + 4, stroke: AXIS });
    barGeom = (v) => ({ left: plotLeft, w: Math.max(2, mag(Math.abs(v)) - plotLeft) });
  }

  spec.bars.forEach((b, i) => {
    const y = padY + i * (rowH + gap);
    const { left, w } = barGeom(b.value);
    marks.push({ t: "rect", x: left, y, w, h: rowH, fill: barColor(spec.colorMode, b), rx: 2 });
    // Category label (left gutter, right-aligned toward the bars).
    marks.push({ t: "text", x: gutter - 10, y: y + rowH / 2, s: b.label, anchor: "end", fill: LABEL, size: 13, weight: b.highlight ? 700 : 400 });
    // Value (fixed right column, right-aligned).
    marks.push({ t: "text", x: W - 8, y: y + rowH / 2, s: b.display, anchor: "end", fill: VALUE, size: 12, weight: 600 });
  });

  return { width: W, height, marks };
}

/**
 * Grouped horizontal bars: one cluster of sub-bars per category (e.g. 2020 vs
 * 2025). Values are all-positive counts, so bars anchor at the left axis. A small
 * legend is drawn above; exact numbers live in the always-present data table.
 */
export function layoutGrouped(spec: GroupedSpec, opts: { labelGutter?: number } = {}): ChartLayout {
  const gutter = opts.labelGutter ?? 110;
  const rightPad = 16;
  const subH = 11;
  const subGap = 3;
  const groupGap = 16;
  const legendH = 26;
  const padY = 8;
  const plotLeft = gutter;
  const plotRight = W - rightPad;

  const nSeries = spec.series.length;
  const clusterH = nSeries * subH + (nSeries - 1) * subGap;
  const max = Math.max(0, ...spec.groups.flatMap((g) => g.values));
  const x = linScale(0, max, plotLeft, plotRight);

  const height = legendH + padY * 2 + spec.groups.length * clusterH + (spec.groups.length - 1) * groupGap;
  const marks: Mark[] = [];

  // Legend row (swatch + name per series).
  let lx = gutter;
  spec.series.forEach((s) => {
    marks.push({ t: "rect", x: lx, y: 6, w: 12, h: 12, fill: s.color, rx: 2 });
    marks.push({ t: "text", x: lx + 18, y: 12, s: s.name, anchor: "start", fill: LABEL, size: 12, weight: 600 });
    lx += 18 + s.name.length * 7.2 + 20;
  });

  // Left axis.
  marks.push({ t: "line", x1: plotLeft, y1: legendH, x2: plotLeft, y2: height - padY, stroke: AXIS });

  spec.groups.forEach((g, i) => {
    const top = legendH + padY + i * (clusterH + groupGap);
    marks.push({ t: "text", x: gutter - 10, y: top + clusterH / 2, s: g.label, anchor: "end", fill: LABEL, size: 12, weight: 400 });
    g.values.forEach((v, s) => {
      const y = top + s * (subH + subGap);
      marks.push({ t: "rect", x: plotLeft, y, w: Math.max(1, x(v) - plotLeft), h: subH, fill: spec.series[s].color, rx: 1 });
    });
  });

  return { width: W, height, marks };
}

export function layout(spec: ChartSpec, opts?: { labelGutter?: number }): ChartLayout {
  return spec.kind === "bars" ? layoutBars(spec, opts) : layoutGrouped(spec, opts);
}
