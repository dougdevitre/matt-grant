import { describe, expect, it } from "vitest";
import { enrichmentByMapName, fillPropensity, precinctEnrichment, PRIMARY_WEIGHTS, propensityByPrecinctLabel } from "./enrich";
import type { VoterAggRow } from "./storeTypes";

const agg = (over: Partial<VoterAggRow> = {}): VoterAggRow => ({
  precinctKey: "st louis#queeny 12",
  county: "St. Louis",
  count: 100,
  active: 90,
  t: [0, 0, 0, 0, 100, 0], // everyone T4
  seg: { BANK: 5, MOBILIZE: 5, PERSUADE: 60, PROSPECT: 20, MONITOR: 10 },
  age: {},
  newReg: 0,
  ...over,
});

describe("precinctEnrichment", () => {
  it("computes the heuristic expected-primary and propensity from the T histogram", () => {
    const e = precinctEnrichment(agg());
    expect(e.expectedPrimary).toBe(60); // 100 × 0.6 (T4 weight)
    expect(e.vPropensity).toBeCloseTo(0.6);
    expect(e.persuade).toBe(60);
    expect(PRIMARY_WEIGHTS[5]).toBeGreaterThan(PRIMARY_WEIGHTS[4]); // monotone recency
  });

  it("clamps and survives an empty precinct", () => {
    expect(precinctEnrichment(agg({ count: 0, t: [0, 0, 0, 0, 0, 0] })).vPropensity).toBe(0);
  });
});

describe("enrichmentByMapName", () => {
  it("joins via the crosswalk and SUMS split precincts onto one map name", () => {
    const res = enrichmentByMapName(
      [
        agg(),
        agg({ precinctKey: "st louis#queeny 12 split 2", count: 50, t: [0, 0, 0, 0, 0, 50], seg: { BANK: 10, MOBILIZE: 0, PERSUADE: 30, PROSPECT: 5, MONITOR: 5 } }),
        agg({ precinctKey: "st louis#mystery 9" }),
      ],
      ["Queeny 12", "Other 3"],
    );
    const q = res.byName.get("Queeny 12")!;
    expect(q.count).toBe(150);
    expect(q.expectedPrimary).toBe(60 + 45); // 100×0.6 + 50×0.9
    expect(q.vPropensity).toBeCloseTo(105 / 150);
    expect(q.persuade).toBe(90);
    expect(q.banked).toBe(0); // no returns passed
    expect(res.misses).toContain("mystery 9");
  });

  it("joins BALLOTAGG banked counts and sums them across split precincts", () => {
    const res = enrichmentByMapName(
      [agg(), agg({ precinctKey: "st louis#queeny 12 split 2", count: 50 })],
      ["Queeny 12"],
      [
        { precinctKey: "st louis#queeny 12", banked: 7, tiers: { "1": 2, "2": 1, "3": 1, "4": 3 } },
        { precinctKey: "st louis#queeny 12 split 2", banked: 3, tiers: { "1": 1, "2": 0, "3": 0, "4": 2 } },
        { precinctKey: "st louis#elsewhere 1", banked: 99, tiers: { "1": 0, "2": 0, "3": 0, "4": 0 } },
      ],
    );
    expect(res.byName.get("Queeny 12")!.banked).toBe(10); // summed, unmatched row ignored
  });
});

describe("propensityByPrecinctLabel", () => {
  it("keys by normalized label and sums shared labels before the ratio", () => {
    const lookup = propensityByPrecinctLabel([
      agg(), // queeny 12: 100 voters, expected 60
      agg({ precinctKey: "franklin#queeny 12", count: 100, t: [0, 100, 0, 0, 0, 0] }), // expected 10
    ]);
    // (60 + 10) / 200 — summed, not averaged (0.6 + 0.1)/2.
    expect(lookup["queeny 12"]).toBeCloseTo(0.35);
  });
});

describe("fillPropensity", () => {
  const lookup = { "queeny 12": 0.6 };

  it("fills a blank propensity from the row's precinct (normalized match)", () => {
    const [r] = fillPropensity([{ precinct: "QUEENY  12", propensity: undefined }], lookup);
    expect(r.propensity).toBeCloseTo(0.6);
  });

  it("never overwrites an explicit propensity and leaves unmatched rows untouched", () => {
    const rows = fillPropensity(
      [
        { precinct: "Queeny 12", propensity: 0.2 }, // staffer's value wins
        { precinct: "Nowhere 1" }, // no match — untouched
        {}, // no precinct — untouched
      ],
      lookup,
    );
    expect(rows[0].propensity).toBe(0.2);
    expect(rows[1].propensity).toBeUndefined();
    expect(rows[2].propensity).toBeUndefined();
  });
});
