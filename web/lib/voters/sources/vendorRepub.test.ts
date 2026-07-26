import { describe, expect, it } from "vitest";
import {
  MAX_PP,
  detectDncColumn,
  detectPhoneColumns,
  detectPrimaryColumns,
  mapVendorRow,
  primaryPropensity,
  resolveColumns,
  votedInElection,
} from "./vendorRepub";
import { detectSource } from "./index";
import { COLUMNS } from "@/lib/voters/parse";

// SYNTHETIC fixtures only — never real voter rows (candidate/voter-file-plan.md §2).

const HEADERS = [
  "StateVoterID",
  "FirstName",
  "LastName",
  "Zip5",
  "CountyName",
  "PrecinctName",
  "PartyCode",
  "PP2026",
  "PG2024",
  "PP2024",
  "PP2022",
  "CellPhone",
  "LandLine",
  "PhoneType",
  "DoNotCall",
];

const resolved = () => {
  const r = resolveColumns(HEADERS);
  if (!r.ok) throw new Error(`fixture headers should resolve: ${r.problems.join("; ")}`);
  return r;
};

const row = (over: Record<number, string> = {}): string[] => {
  const base = [
    "MO123", "Ann", "Smith", "63084", "Franklin", "Union 1", "R",
    "Y", "N", "Y", "N",
    "3145551234", "6365555678", "Wireless", "",
  ];
  for (const [i, v] of Object.entries(over)) base[Number(i)] = v;
  return base;
};

describe("resolveColumns", () => {
  it("resolves the semantic fields from real header names", () => {
    const r = resolved();
    expect(r.map.voterId).toBe(0);
    expect(r.map.county).toBe(4);
    expect(r.map.precinct).toBe(5);
    expect(r.map.party).toBe(6);
  });

  it("is insensitive to case, spaces, underscores, and hyphens", () => {
    const r = resolveColumns(["state_voter_id", "LAST NAME", "Zip-Code", "county", "Precinct"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.map.voterId).toBe(0);
  });

  it("reports EVERY unresolved required field at once, not one per run", () => {
    const r = resolveColumns(["Mystery1", "Mystery2"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems.some((p) => p.includes('"county"'))).toBe(true);
      expect(r.problems.some((p) => p.includes('"precinct"'))).toBe(true);
      expect(r.problems.some((p) => p.includes("no join key"))).toBe(true);
    }
  });

  it("accepts name+ZIP as the join key when there is no voter ID", () => {
    const r = resolveColumns(["LastName", "Zip", "County", "Precinct"]);
    expect(r.ok).toBe(true);
  });

  it("refuses when neither a voter ID nor a complete name+ZIP key exists", () => {
    // LastName without a ZIP cannot be joined conservatively — half a key is
    // worse than none, because it invites ambiguous matches.
    const r = resolveColumns(["LastName", "County", "Precinct"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.some((p) => p.includes("no join key"))).toBe(true);
  });
});

describe("detectPrimaryColumns", () => {
  it("finds primary columns, newest first, and captures the year", () => {
    const cols = detectPrimaryColumns(HEADERS);
    expect(cols.map((c) => c.year)).toEqual([2026, 2024, 2022]);
  });

  it("never treats a general or municipal election as a primary", () => {
    // A general-election vote says little about August-primary behavior.
    const cols = detectPrimaryColumns(["PG2024", "General2022", "Municipal2025", "PP2024"]);
    expect(cols.map((c) => c.header)).toEqual(["PP2024"]);
  });

  it("recognizes the common naming conventions", () => {
    const cols = detectPrimaryColumns(["Primary2024", "2022 Primary", "Aug2020", "P2018"]);
    expect(cols.map((c) => c.year)).toEqual([2024, 2022, 2020, 2018]);
  });

  it("returns nothing when the file carries no primary history", () => {
    expect(detectPrimaryColumns(["FirstName", "Zip"])).toEqual([]);
  });
});

describe("votedInElection", () => {
  it("accepts the many ways vendors encode a vote", () => {
    for (const v of ["Y", "y", "X", "1", "T", "true", "A", "E", "P", "absentee", "Early", "voted"]) {
      expect(votedInElection(v), v).toBe(true);
    }
  });

  it("rejects blanks and explicit non-votes", () => {
    for (const v of ["", "  ", "N", "n", "0", "false", null, undefined]) {
      expect(votedInElection(v), String(v)).toBe(false);
    }
  });
});

describe("primaryPropensity", () => {
  const cols = () => detectPrimaryColumns(HEADERS);

  it("counts the primaries the voter actually voted in", () => {
    // Fixture votes PP2026 and PP2024, skips PP2022.
    expect(primaryPropensity(row(), cols())).toBe(2);
  });

  it("returns 0 for someone who had the chance and didn't vote", () => {
    expect(primaryPropensity(row({ 7: "N", 9: "N", 10: "N" }), cols())).toBe(0);
  });

  it("returns undefined when the file has NO primary columns — unknown, not zero", () => {
    // This distinction drives the composer: an unknown propensity must not be
    // rendered as "never votes in primaries" or swept up by a pp:0 filter.
    expect(primaryPropensity(row(), [])).toBeUndefined();
  });

  it("caps at MAX_PP so the score reads on the same 0-5 scale as turnout", () => {
    const many = Array.from({ length: 8 }, (_, i) => `PP${2026 - i * 2}`);
    const allVoted = many.map(() => "Y");
    expect(primaryPropensity(allVoted, detectPrimaryColumns(many))).toBe(MAX_PP);
  });
});

describe("phone detection", () => {
  it("finds number-bearing columns and tags the line type", () => {
    const cols = detectPhoneColumns(HEADERS);
    expect(cols.map((c) => c.header)).toEqual(["CellPhone", "LandLine"]);
    expect(cols[0].lineType).toBe("wireless");
    expect(cols[1].lineType).toBe("landline");
  });

  it("excludes descriptor columns — PhoneType holds a category, not a number", () => {
    expect(detectPhoneColumns(["PhoneType"])).toEqual([]);
  });

  it("finds the do-not-call column", () => {
    expect(detectDncColumn(HEADERS)).toBe(14);
    expect(detectDncColumn(["FirstName"])).toBeUndefined();
  });
});

describe("mapVendorRow", () => {
  const dncColumn = detectDncColumn(HEADERS);

  it("maps a complete row", () => {
    const rec = mapVendorRow(row(), resolved(), { dncColumn })!;
    expect(rec).toMatchObject({
      voterId: "MO123",
      lastName: "Smith",
      zip: "63084",
      county: "Franklin",
      precinct: "Union 1",
      pp: 2,
      party: "REP",
    });
    expect(rec.phones.map((p) => p.number)).toEqual(["3145551234", "6365555678"]);
  });

  it("normalizes party to a canonical code — and it is INFERRED, not registered", () => {
    expect(mapVendorRow(row({ 6: "Republican" }), resolved())!.party).toBe("REP");
    expect(mapVendorRow(row({ 6: "D" }), resolved())!.party).toBe("DEM");
  });

  it("omits party entirely when the cell is blank — blank is not 'other'", () => {
    expect(mapVendorRow(row({ 6: "" }), resolved())!.party).toBeUndefined();
  });

  it("truncates ZIP+4 to a 5-digit ZIP", () => {
    expect(mapVendorRow(row({ 3: "63084-1234" }), resolved())!.zip).toBe("63084");
  });

  it("propagates a do-not-call flag onto every number in the row", () => {
    const rec = mapVendorRow(row({ 14: "Y" }), resolved(), { dncColumn })!;
    expect(rec.phones.every((p) => p.doNotCall)).toBe(true);
  });

  it("skips a row with no geography — the overlay shard key needs both parts", () => {
    expect(mapVendorRow(row({ 4: "" }), resolved())).toBeNull();
    expect(mapVendorRow(row({ 5: "" }), resolved())).toBeNull();
  });

  it("skips a row with no usable join key", () => {
    // No voter ID and an incomplete name+ZIP fallback → unjoinable.
    expect(mapVendorRow(row({ 0: "", 3: "" }), resolved())).toBeNull();
    expect(mapVendorRow(row({ 0: "", 2: "" }), resolved())).toBeNull();
  });

  it("keeps a row that has only the name+ZIP fallback key", () => {
    const rec = mapVendorRow(row({ 0: "" }), resolved());
    expect(rec).not.toBeNull();
    expect(rec!.voterId).toBeUndefined();
    expect(rec!.lastName).toBe("Smith");
  });

  it("carries no phones when the file has none", () => {
    const headers = ["StateVoterID", "CountyName", "PrecinctName"];
    const r = resolveColumns(headers);
    expect(r.ok).toBe(true);
    if (r.ok) expect(mapVendorRow(["MO1", "Franklin", "Union 1"], r)!.phones).toEqual([]);
  });
});

describe("detectSource", () => {
  it("identifies the official export by its exact 36-column header", () => {
    expect(detectSource([...COLUMNS])).toEqual({ ok: true, source: "official" });
  });

  it("identifies a vendor export by resolvable field names", () => {
    expect(detectSource(HEADERS)).toEqual({ ok: true, source: "vendorRepub" });
  });

  it("flags a DRIFTED official export rather than falling through to vendor", () => {
    // The dangerous case: the official parser is INDEX-based, so a renamed column
    // would silently mis-read every row. It must be called out, not worked around.
    const drifted: string[] = [...COLUMNS];
    drifted[3] = "Middle Initial";
    const res = detectSource(drifted);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.problems[0]).toContain("DRIFTED official export");
  });

  it("reports the vendor adapter's problems for an unrecognizable header", () => {
    const res = detectSource(["nope", "nothing"]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.problems.join(" ")).toContain("no join key");
  });
});
