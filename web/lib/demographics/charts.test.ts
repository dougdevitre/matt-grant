import { describe, it, expect, vi } from "vitest";

// charts.ts is server-only (it reads the committed JSON via the loaders); mock the
// marker so the module imports under vitest (same pattern as airtable/health.test.ts).
vi.mock("server-only", () => ({}));

// eslint-disable-next-line import/first
import { CHARTS } from "./charts";

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
    expect(cell("Lincoln County")).toBe("+5.0%"); // alt: +5.0%
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
