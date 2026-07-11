import { describe, it, expect } from "vitest";
import { colorExpr, heightExpr, legendFor, modeStats } from "./precinctPaint";
import { TIER_COLOR, TURNOUT_RAMP } from "@/lib/viz/palette";

const feat = (props: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [0, 0] },
});

describe("modeStats", () => {
  it("finds max expected/gotv/persuade across features, ignoring missing values", () => {
    const stats = modeStats([
      feat({ expected: 900, gotv: 1200, persuade: 800 }),
      feat({ expected: 1500, persuade: 2400 }),
      feat({}),
    ]);
    expect(stats).toEqual({ maxExpected: 1500, maxGotv: 1200, maxPersuade: 2400 });
  });

  it("is all-zero on empty input (expressions still guard with max(1, …))", () => {
    expect(modeStats([])).toEqual({ maxExpected: 0, maxGotv: 0, maxPersuade: 0 });
  });
});

describe("colorExpr", () => {
  const stats = { maxExpected: 1500, maxGotv: 1200, maxPersuade: 2400 };

  it("turnout mode keeps the original ramp at the 8/18/28/40 stops", () => {
    const e = colorExpr("turnout", stats) as unknown[];
    expect(e[0]).toBe("interpolate");
    expect(e).toContain(8);
    expect(e).toContain(40);
    expect(e).toContain(TURNOUT_RAMP[0]);
    expect(e).toContain(TURNOUT_RAMP[3]);
  });

  it("tier mode matches A/B/C to the shared TIER_COLOR (table ↔ map parity)", () => {
    const e = colorExpr("tier", stats) as unknown[];
    expect(e[0]).toBe("match");
    expect(e).toContain(TIER_COLOR.A);
    expect(e).toContain(TIER_COLOR.B);
    expect(e).toContain(TIER_COLOR.C);
  });

  it("gotv mode derives its stops from the data max", () => {
    const e = colorExpr("gotv", stats) as unknown[];
    expect(e[0]).toBe("interpolate");
    expect(e).toContain(1200); // top stop = maxGotv
  });

  it("gotv mode never emits duplicate stops on empty data (max clamped to 1)", () => {
    const e = colorExpr("gotv", { maxExpected: 0, maxGotv: 0, maxPersuade: 0 }) as unknown[];
    expect(e).toContain(1); // clamped top stop, not a 0/0 duplicate
  });

  it("voter mode ramps over the heuristic vPropensity (0..1), coalescing unmatched to 0", () => {
    const e = colorExpr("voter", stats) as unknown[];
    expect(e[0]).toBe("interpolate");
    expect(JSON.stringify(e)).toContain('["coalesce",["get","vPropensity"],0]');
    expect(e).toContain(0.1);
    expect(e).toContain(0.7);
  });
});

describe("heightExpr", () => {
  it("turnout mode keeps the original t×130 extrusion", () => {
    expect(heightExpr("turnout", { maxExpected: 0, maxGotv: 0, maxPersuade: 0 })).toEqual([
      "*",
      ["coalesce", ["get", "turnout"], 0],
      130,
    ]);
  });

  it("tier mode scales expected ballots so the tallest column hits the shared ceiling", () => {
    const e = heightExpr("tier", { maxExpected: 1500, maxGotv: 0, maxPersuade: 0 }) as unknown[];
    expect(e[0]).toBe("*");
    expect(e[2]).toBe(3); // 4500 / 1500
  });

  it("gotv mode scales by maxGotv and guards a zero max", () => {
    const e = heightExpr("gotv", { maxExpected: 0, maxGotv: 0, maxPersuade: 0 }) as unknown[];
    expect(e[2]).toBe(4500); // 4500 / max(1, 0) — finite, no divide-by-zero
  });

  it("voter mode extrudes the PERSUADE universe scaled by maxPersuade", () => {
    const e = heightExpr("voter", { maxExpected: 0, maxGotv: 0, maxPersuade: 2250 }) as unknown[];
    expect(e[0]).toBe("*");
    expect(JSON.stringify(e)).toContain('["coalesce",["get","persuade"],0]');
    expect(e[2]).toBe(2); // 4500 / 2250
  });
});

describe("legendFor", () => {
  it("tier legend swatches use the same three colors as the paint expression", () => {
    const l = legendFor("tier", { maxExpected: 1500, maxGotv: 0, maxPersuade: 0 });
    expect(l.kind).toBe("swatches");
    if (l.kind === "swatches") {
      expect(l.entries.map((e) => e.color)).toEqual([TIER_COLOR.A, TIER_COLOR.B, TIER_COLOR.C]);
    }
  });

  it("gotv legend max label tracks the data; turnout keeps the ~8/~40 range", () => {
    const g = legendFor("gotv", { maxExpected: 0, maxGotv: 1200, maxPersuade: 0 });
    expect(g.kind).toBe("gradient");
    if (g.kind === "gradient") expect(g.maxLabel).toContain("1,200");
    const t = legendFor("turnout", { maxExpected: 0, maxGotv: 0, maxPersuade: 0 });
    if (t.kind === "gradient") {
      expect(t.minLabel).toBe("~8%");
      expect(t.maxLabel).toBe("~40%");
    }
  });

  it("voter legend is a gradient that declares the heuristic and its source doc", () => {
    const v = legendFor("voter", { maxExpected: 0, maxGotv: 0, maxPersuade: 2400 });
    expect(v.kind).toBe("gradient");
    expect(v.note).toContain("heuristic");
    expect(v.note).toContain("voter-file-plan.md");
  });
});
