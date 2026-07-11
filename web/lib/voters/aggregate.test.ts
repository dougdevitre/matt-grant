import { describe, expect, it } from "vitest";
import { aggregateVoters, newAgg, type AggregatableVoter } from "./aggregate";

// SYNTHETIC fixtures only.
const v = (over: Partial<AggregatableVoter>): AggregatableVoter => ({
  active: true,
  t: 4,
  segment: "PERSUADE",
  yob: 1980,
  newRegistrant: false,
  ...over,
});

describe("aggregateVoters", () => {
  it("reproduces the ingest math: count/active/t/seg/age/newReg", () => {
    const agg = aggregateVoters(
      [
        v({}),
        v({ segment: "BANK", t: 5 }),
        v({ segment: "MOBILIZE", t: 2, active: true, newRegistrant: true, yob: 2004 }),
        v({ segment: "MONITOR", t: 0, active: false, yob: null }),
      ],
      "St. Louis",
    );
    expect(agg.count).toBe(4);
    expect(agg.active).toBe(3);
    expect(agg.t[4]).toBe(1);
    expect(agg.t[5]).toBe(1);
    expect(agg.t[2]).toBe(1);
    expect(agg.t[0]).toBe(1);
    expect(agg.seg).toMatchObject({ PERSUADE: 1, BANK: 1, MOBILIZE: 1, MONITOR: 1, PROSPECT: 0 });
    expect(agg.newReg).toBe(1);
    expect(agg.county).toBe("St. Louis");
  });

  it("computes the chase-tier universes (the field VOTERAGG.seg can't split)", () => {
    const agg = aggregateVoters(
      [
        v({ segment: "MOBILIZE", t: 2 }), // Tier 1
        v({ segment: "BANK", t: 4 }), // Tier 2
        v({ segment: "BANK", t: 5 }), // Tier 3
        v({ segment: "PERSUADE", t: 4 }), // Tier 4
        v({ segment: "PROSPECT", t: 2 }), // no chase
        v({ segment: "MONITOR", t: 0, active: false }), // no chase
      ],
      "Franklin",
    );
    expect(agg.tiers).toEqual({ "1": 1, "2": 1, "3": 1, "4": 1 });
  });

  it("starts from a clean zero agg", () => {
    expect(newAgg("X").tiers).toEqual({ "1": 0, "2": 0, "3": 0, "4": 0 });
    expect(newAgg("X").t).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
