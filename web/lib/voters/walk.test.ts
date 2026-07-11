import { describe, expect, it } from "vitest";
import { allocateTurfs, buildHouseholds, cutTurfs, parseStreet } from "./walk";
import type { StoredVoter } from "./storeTypes";

// SYNTHETIC voters only — never real voter-file rows (voter-file-plan.md §2).
const voter = (over: Partial<StoredVoter>): StoredVoter => ({
  voterId: over.voterId ?? `V${Math.abs(JSON.stringify(over).length)}`,
  firstName: "Test",
  lastName: "Voter",
  address: "1 Main St",
  city: "Ballwin",
  zip: "63011",
  county: "St. Louis",
  precinctName: "Sample 1",
  yob: 1980,
  active: true,
  lastVoted: null,
  t: 3,
  s: 1,
  segment: "PROSPECT",
  newRegistrant: false,
  ...over,
});

describe("parseStreet", () => {
  it("splits house number from street and normalizes", () => {
    expect(parseStreet(" 1024  n elm st ")).toEqual({ houseNum: 1024, street: "N ELM ST" });
  });
  it("handles numberless addresses", () => {
    expect(parseStreet("Rural Route 4")).toEqual({ houseNum: null, street: "RURAL ROUTE 4" });
  });
});

describe("buildHouseholds", () => {
  it("groups voters at the same door and sorts by street then house number", () => {
    const hhs = buildHouseholds([
      voter({ voterId: "1", address: "12 Oak Ave" }),
      voter({ voterId: "2", address: "3 Oak Ave" }),
      voter({ voterId: "3", address: "3 Oak Ave" }), // same door as #2
      voter({ voterId: "4", address: "5 Birch Ct" }),
      voter({ voterId: "5", address: "3 Oak Ave", unit: "Apt 2" }), // separate door (unit)
    ]);
    expect(hhs.map((h) => `${h.address}${h.unit ? ` ${h.unit}` : ""}`)).toEqual([
      "5 Birch Ct",
      "3 Oak Ave",
      "3 Oak Ave Apt 2",
      "12 Oak Ave", // numeric sort: 3 before 12
    ]);
    expect(hhs[1].voters).toHaveLength(2);
  });
});

describe("cutTurfs", () => {
  const manyVoters = (n: number) =>
    Array.from({ length: n }, (_, i) => voter({ voterId: `V${i}`, address: `${i + 1} Long Rd` }));

  it("keeps a small precinct as one turf", () => {
    const turfs = cutTurfs(manyVoters(35));
    expect(turfs).toHaveLength(1);
    expect(turfs[0].doors).toBe(35);
    expect(turfs[0].index).toBe(1);
  });

  it("cuts 100 doors into two ~50-door turfs (the 40-60 band)", () => {
    const turfs = cutTurfs(manyVoters(100));
    expect(turfs).toHaveLength(2);
    expect(turfs.map((t) => t.doors)).toEqual([50, 50]);
    for (const t of turfs) {
      expect(t.doors).toBeGreaterThanOrEqual(40);
      expect(t.doors).toBeLessThanOrEqual(60);
    }
  });

  it("counts doors (households), not voters, and keeps streets contiguous", () => {
    // 120 voters but only 60 doors (2 per door) → one turf.
    const voters = Array.from({ length: 120 }, (_, i) =>
      voter({ voterId: `V${i}`, address: `${Math.floor(i / 2) + 1} Pair Ln` }),
    );
    const turfs = cutTurfs(voters);
    expect(turfs).toHaveLength(1);
    expect(turfs[0].doors).toBe(60);
    expect(turfs[0].voters).toBe(120);
    expect(turfs[0].streets).toEqual(["PAIR LN"]);
  });

  it("returns [] for no voters", () => {
    expect(cutTurfs([])).toEqual([]);
  });
});

describe("allocateTurfs", () => {
  it("round-robins captains and leaves turfs unassigned without a roster", () => {
    const turfs = cutTurfs(Array.from({ length: 150 }, (_, i) => voter({ voterId: `V${i}`, address: `${i + 1} A St` })));
    expect(turfs).toHaveLength(3);
    const caps = [
      { id: "a@x.com", name: "Ann" },
      { id: "b@x.com", name: "Bo" },
    ];
    const alloc = allocateTurfs(turfs, caps);
    expect(alloc.map((t) => t.captain?.name)).toEqual(["Ann", "Bo", "Ann"]);
    expect(allocateTurfs(turfs, []).every((t) => t.captain === null)).toBe(true);
  });
});
