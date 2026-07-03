import { describe, it, expect, vi } from "vitest";

// charts.ts is server-only (it reads the committed JSON via the loaders); mock the
// marker so the module imports under vitest (same pattern as airtable/health.test.ts).
vi.mock("server-only", () => ({}));

// eslint-disable-next-line import/first
import { CHARTS } from "./charts";
// eslint-disable-next-line import/first
import { layout, type Mark } from "@/lib/viz/chart";

// Drift guard: the ChartDef.alt sentences quote specific figures ("St. Louis County
// −5.9%", "20.1% age 65+"). Those numbers must keep coming out of the computed
// table() cells — so editing the CSVs without updating the alt text fails here.
const table = (id: string) => CHARTS[id].table();

describe("chart alt ↔ computed table (drift guard)", () => {
  it("mo02-child-under15: the county %s the alt quotes match the table", () => {
    const { columns, rows } = table("mo02-child-under15");
    const pctCol = columns.indexOf("% change");
    const cell = (county: string) => rows.find((r) => r[0] === county)?.[pctCol];
    expect(cell("St. Louis County")).toBe("-5.9%"); // alt: −5.9%
    expect(cell("Jefferson County")).toBe("-5.6%"); // alt: −5.6%
    // Non-district counties (MO-03) must NOT appear in the MO-02 table.
    expect(cell("St. Charles County")).toBeUndefined();
    expect(cell("Lincoln County")).toBeUndefined();
  });

  it("under5-metro-ranking: St. Louis is the 3rd row at -11.2%", () => {
    const third = table("under5-metro-ranking").rows[2]; // [rank, metro, fewer, % decline]
    expect(String(third[1])).toContain("St. Louis");
    expect(third[3]).toBe("-11.2%");
  });

  it("aging-index-metro: St. Louis shows 20.1% age 65+", () => {
    const { columns, rows } = table("aging-index-metro");
    const pctCol = columns.indexOf("% 65+ (2025)");
    const stl = rows.find((r) => String(r[1]).includes("St. Louis"));
    expect(stl?.[pctCol]).toBe("20.1%");
  });
});

// The chart() builders re-derive rows independently of table() (same sort/slice/
// filter), so they can silently drift. Guard the invariants the SVG relies on.
describe("chart() specs (drift guard)", () => {
  const nonTotalRows = (id: string) => table(id).rows.filter((r) => !/Total/i.test(String(r[0]))).length;

  it("every chart()'s bar/group count matches its (non-Total) table rows", () => {
    for (const id of Object.keys(CHARTS)) {
      const def = CHARTS[id];
      if (!def.chart) continue;
      const spec = def.chart();
      const count = spec.kind === "bars" ? spec.bars.length : spec.groups.length;
      expect(count, `${id} bar/group count`).toBe(nonTotalRows(id));
    }
  });

  it("ranked charts highlight exactly the St. Louis bar", () => {
    for (const id of ["under5-metro-ranking", "aging-index-metro"]) {
      const spec = CHARTS[id].chart!();
      if (spec.kind !== "bars") throw new Error(`${id} should be bars`);
      const hl = spec.bars.filter((b) => b.highlight);
      expect(hl.length, `${id} highlight count`).toBe(1);
      expect(hl[0].label).toContain("St. Louis");
    }
  });

  it("mo02-child-under15 is single-sign and left-anchored (not the degenerate right-pinned render)", () => {
    const spec = CHARTS["mo02-child-under15"].chart!();
    if (spec.kind !== "bars") throw new Error("mo02 should be bars");
    expect(spec.bars.length).toBeGreaterThan(0);
    expect(spec.bars.every((b) => b.value < 0)).toBe(true); // both counties declined
    const { marks } = layout(spec);
    const axis = marks.find((m): m is Extract<Mark, { t: "line" }> => m.t === "line")!;
    const firstBar = marks.find((m): m is Extract<Mark, { t: "rect" }> => m.t === "rect")!;
    // The axis line sits at the bars' left edge (left-anchored), not jammed at the right.
    expect(firstBar.x).toBeCloseTo(axis.x1, 5);
  });
});
