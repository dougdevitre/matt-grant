import { describe, expect, it } from "vitest";
import { chaseReport, chaseTier, mapReturnRows } from "./chase";
import { sFromCanvassId, segmentFor } from "./score";
import { parseCsv } from "@/lib/contacts/import";
import type { VoterAggRow } from "./storeTypes";

// SYNTHETIC fixtures only — never real voter rows.

describe("sFromCanvassId", () => {
  it("maps the walk-sheet 1-5 scale onto S (both 'other' leans → 0 = do-not-chase)", () => {
    expect(sFromCanvassId(1)).toBe(3);
    expect(sFromCanvassId(2)).toBe(2);
    expect(sFromCanvassId(3)).toBe(1);
    expect(sFromCanvassId(4)).toBe(0);
    expect(sFromCanvassId(5)).toBe(0);
  });

  it("a Strong Grant ID on a low-T voter lands them in MOBILIZE (Tier 1)", () => {
    const s = sFromCanvassId(1);
    expect(segmentFor(2, s)).toBe("MOBILIZE");
    expect(chaseTier(segmentFor(2, s), 2)).toBe("1");
  });
});

describe("chaseTier", () => {
  it("maps segments + T onto the ballot-chase-program tiers", () => {
    expect(chaseTier("MOBILIZE", 2)).toBe("1"); // Chase Hard — wins the race
    expect(chaseTier("BANK", 4)).toBe("2"); // Chase Firm
    expect(chaseTier("BANK", 5)).toBe("3"); // Chase Light
    expect(chaseTier("PERSUADE", 4)).toBe("4"); // Persuasion GOTV
  });

  it("never chases MONITOR (opponents/inactive) or PROSPECT (unknown, unlikely)", () => {
    expect(chaseTier("MONITOR", 5)).toBeNull();
    expect(chaseTier("PROSPECT", 3)).toBeNull();
  });
});

describe("chaseReport", () => {
  const agg = (precinctKey: string, tiers: VoterAggRow["tiers"]): VoterAggRow => ({
    precinctKey,
    county: "St. Louis",
    count: 100,
    active: 90,
    t: [0, 0, 0, 0, 100, 0],
    seg: { BANK: 10, MOBILIZE: 20, PERSUADE: 30, PROSPECT: 20, MONITOR: 20 },
    age: {},
    newReg: 0,
    tiers,
  });

  it("sums universes, banked, outstanding, and % per tier and overall", () => {
    const r = chaseReport(
      [
        agg("st louis#a", { "1": 20, "2": 6, "3": 4, "4": 30 }),
        agg("st louis#b", { "1": 10, "2": 4, "3": 6, "4": 20 }),
      ],
      [{ precinctKey: "st louis#a", banked: 12, tiers: { "1": 5, "2": 2, "3": 1, "4": 2 } }],
    );
    expect(r.universe).toBe(100);
    expect(r.banked).toBe(10); // tiered banked only
    expect(r.bankedAll).toBe(12); // includes the 2 non-chase returns
    expect(r.outstanding).toBe(90);
    expect(r.pctComplete).toBe(10);
    expect(r.tiers[0]).toMatchObject({ tier: "1", universe: 30, banked: 5, outstanding: 25 });
    // Precinct with the larger outstanding chase universe sorts first.
    expect(r.precincts[0].precinctKey).toBe("st louis#a"); // 60-10=50 vs 40-0=40
    expect(r.precincts[0].outstanding).toBe(50);
  });

  it("survives rollups without tier counts (pre-Phase-5 aggs) and zero division", () => {
    const r = chaseReport([agg("st louis#c", undefined)], []);
    expect(r.universe).toBe(0);
    expect(r.pctComplete).toBe(0);
  });
});

describe("mapReturnRows", () => {
  it("maps header aliases; only a voter id is required", () => {
    const res = mapReturnRows(
      parseCsv(["Voter ID,Ballot Date,Ballot Type", "V001,2026-07-21,In-person absentee", ",2026-07-21,Mail"].join("\n")),
    );
    expect(res.valid).toEqual([{ voterId: "V001", votedAt: "2026-07-21", method: "In-person absentee" }]);
    expect(res.skipped).toBe(1);
    expect(res.total).toBe(2);
  });

  it("handles an id-only file and empty input", () => {
    const res = mapReturnRows(parseCsv("voter_id\nV1\nV2"));
    expect(res.valid).toEqual([{ voterId: "V1" }, { voterId: "V2" }]);
    expect(mapReturnRows([]).total).toBe(0);
  });
});
