import { describe, expect, it } from "vitest";
import { districtRollup, excludeBanked, filterVoters, votersToCsv, RSMO_NOTICE } from "./dashboard";
import type { StoredVoter, VoterAggRow } from "./storeTypes";

// SYNTHETIC fixtures only — never real voter rows.
const agg = (over: Partial<VoterAggRow> = {}): VoterAggRow => ({
  precinctKey: "st louis#queeny 12",
  county: "St. Louis",
  count: 100,
  active: 90,
  t: [10, 10, 10, 10, 40, 20],
  seg: { BANK: 5, MOBILIZE: 5, PERSUADE: 60, PROSPECT: 20, MONITOR: 10 },
  age: { "65+": 30, "35-49": 70 },
  newReg: 4,
  ...over,
});

const voter = (over: Partial<StoredVoter> = {}): StoredVoter => ({
  voterId: "1",
  firstName: "Testy",
  lastName: "McTestface",
  address: "42 SAMPLE DR",
  city: "BALLWIN",
  zip: "63011",
  county: "St. Louis",
  precinctName: "QUEENY 12",
  yob: 1970,
  active: true,
  lastVoted: { date: "2024-11-05", year: 2024, label: "General" },
  t: 4,
  s: 1,
  segment: "PERSUADE",
  newRegistrant: false,
  ...over,
});

describe("districtRollup", () => {
  it("sums counts, histograms, segments, and county shares", () => {
    const r = districtRollup([
      agg(),
      agg({ precinctKey: "franklin#union 1", county: "Franklin", count: 50, active: 45, newReg: 1 }),
    ]);
    expect(r.voters).toBe(150);
    expect(r.active).toBe(135);
    expect(r.newReg).toBe(5);
    expect(r.t[4]).toBe(80);
    expect(r.seg.PERSUADE).toBe(120);
    expect(r.byCounty[0]).toMatchObject({ county: "St. Louis", voters: 100 });
    expect(r.byCounty[1].share).toBeCloseTo(50 / 150);
    expect(r.precincts).toBe(2);
  });

  it("handles the empty board", () => {
    const r = districtRollup([]);
    expect(r.voters).toBe(0);
    expect(r.byCounty).toEqual([]);
  });
});

describe("filterVoters", () => {
  const voters = [
    voter({ voterId: "1", segment: "PERSUADE", t: 4, address: "42 SAMPLE DR" }),
    voter({ voterId: "2", segment: "BANK", t: 5, yob: 1950, address: "7 OTHER LN" }),
    voter({ voterId: "3", segment: "PERSUADE", t: 3, address: "9 SAMPLE DR" }),
  ];
  it("applies segment, minT, age band, and street filters together", () => {
    expect(filterVoters(voters, { segment: "PERSUADE" }).map((v) => v.voterId)).toEqual(["1", "3"]);
    expect(filterVoters(voters, { minT: 4 }).map((v) => v.voterId)).toEqual(["1", "2"]);
    expect(filterVoters(voters, { ageBand: "65+" }).map((v) => v.voterId)).toEqual(["2"]);
    expect(filterVoters(voters, { street: "sample", segment: "PERSUADE", minT: 4 }).map((v) => v.voterId)).toEqual(["1"]);
    expect(filterVoters(voters, {})).toHaveLength(3);
  });
});

describe("votersToCsv", () => {
  it("stamps the RSMo notice first, then channel-specific headers", () => {
    const csv = votersToCsv([voter()], "walk");
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("RSMo 115.157");
    expect(lines[1]).toContain("Canvass ID (1-5)");
    expect(lines[2]).toContain("McTestface, Testy");
    expect(votersToCsv([voter()], "call").split("\r\n")[1]).toContain("Phone (matched only");
    expect(votersToCsv([voter()], "mail").split("\r\n")[1]).toContain("Mailing address");
  });

  it("neutralizes leading-formula cells (Excel injection guard)", () => {
    const csv = votersToCsv([voter({ lastName: "=cmd()", address: "+1 EVIL RD" })], "walk");
    expect(csv).toContain("'=cmd()");
    expect(csv).toContain("'+1 EVIL RD");
    expect(RSMO_NOTICE).toContain("political/election purposes only");
  });
});

describe("excludeBanked", () => {
  const voters = [voter({ voterId: "A" }), voter({ voterId: "B" }), voter({ voterId: "C" })];

  it("drops banked ids when hiding (the chase doc's remove-from-lists rule)", () => {
    const out = excludeBanked(voters, { B: "2026-07-21", Z: "" }, true);
    expect(out.map((v) => v.voterId)).toEqual(["A", "C"]); // unknown id Z ignored
  });

  it("keeps everyone when the toggle is off, and is a no-op with no returns", () => {
    expect(excludeBanked(voters, { B: "" }, false)).toHaveLength(3);
    expect(excludeBanked(voters, {}, true)).toHaveLength(3);
  });
});
