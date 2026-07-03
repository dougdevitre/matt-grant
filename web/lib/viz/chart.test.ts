import { describe, it, expect } from "vitest";
import { linScale, layoutBars, layoutGrouped, type BarsSpec, type GroupedSpec, type Mark } from "./chart";
import { DIVERGING, BRAND } from "./palette";

type RectMark = Extract<Mark, { t: "rect" }>;
const rects = (marks: Mark[]): RectMark[] => marks.filter((m): m is RectMark => m.t === "rect");

describe("linScale", () => {
  it("maps domain endpoints to range endpoints", () => {
    const s = linScale(0, 10, 100, 200);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(200);
    expect(s(5)).toBe(150);
  });
  it("pins to range start on a degenerate (zero-width) domain", () => {
    const s = linScale(4, 4, 100, 200);
    expect(s(4)).toBe(100);
    expect(s(999)).toBe(100);
  });
});

describe("layoutBars", () => {
  it("all-positive data anchors every bar at the left axis (zero line = plot left)", () => {
    const spec: BarsSpec = {
      kind: "bars",
      colorMode: "highlight",
      bars: [
        { label: "A", value: 10, display: "10", highlight: true },
        { label: "B", value: 5, display: "5" },
      ],
    };
    const { marks } = layoutBars(spec, { labelGutter: 100 });
    const bars = rects(marks) as { x: number; w: number; fill: string }[];
    // Both bars start at the same left edge (the axis).
    expect(bars[0].x).toBe(bars[1].x);
    // The larger value produces the longer bar.
    expect(bars[0].w).toBeGreaterThan(bars[1].w);
    // highlight mode: emphasized bar is brick, the other muted (not brick).
    expect(bars[0].fill).toBe(BRAND.brick);
    expect(bars[1].fill).not.toBe(BRAND.brick);
  });

  it("diverging data grows bars out from a zero baseline in both directions", () => {
    const spec: BarsSpec = {
      kind: "bars",
      colorMode: "diverging",
      bars: [
        { label: "up", value: 100, display: "+100" },
        { label: "down", value: -50, display: "-50" },
      ],
    };
    const { marks } = layoutBars(spec);
    const bars = rects(marks) as { x: number; w: number; fill: string }[];
    const zeroX = bars[0].x; // positive bar starts at zero baseline
    // Negative bar ends at the baseline (its right edge == zeroX).
    expect(bars[1].x + bars[1].w).toBeCloseTo(zeroX, 5);
    // Sign drives color.
    expect(bars[0].fill).toBe(DIVERGING.positive);
    expect(bars[1].fill).toBe(DIVERGING.negative);
  });

  it("gives a near-zero value a minimum-width sliver so it stays visible", () => {
    const spec: BarsSpec = {
      kind: "bars",
      colorMode: "field",
      bars: [
        { label: "big", value: 1000, display: "1000" },
        { label: "tiny", value: 0, display: "0" },
      ],
    };
    const bars = rects(layoutBars(spec).marks) as { w: number }[];
    expect(bars[1].w).toBeGreaterThanOrEqual(2);
  });
});

describe("layoutGrouped", () => {
  it("emits one sub-bar per series per group, colored by series", () => {
    const spec: GroupedSpec = {
      kind: "grouped",
      series: [
        { name: "2020", color: "#B7C0CC" },
        { name: "2025", color: BRAND.field },
      ],
      groups: [
        { label: "0-14", values: [100, 90] },
        { label: "65+", values: [50, 70] },
      ],
    };
    const { marks } = layoutGrouped(spec);
    // 2 groups × 2 series = 4 data bars, + 2 legend swatches = 6 rects.
    expect(rects(marks)).toHaveLength(6);
    // The 2025 sub-bar in the 65+ group is longer than its 2020 sub-bar (70 > 50).
    const dataBars = (rects(marks) as { x: number; w: number; fill: string }[]).filter(
      (r) => r.fill === BRAND.field || r.fill === "#B7C0CC",
    );
    // last group's two bars are the final two data rects
    const g65 = dataBars.slice(-2);
    expect(g65[1].w).toBeGreaterThan(g65[0].w);
  });
});
