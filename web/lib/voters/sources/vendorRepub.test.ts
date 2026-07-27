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

// ---------------------------------------------------------------------------
// The RNC / Numinar MO-02 export (candidate/voter-registry-refresh-plan.md §5)
// ---------------------------------------------------------------------------
//
// The real 68-column header row of the three primary-propensity exports. The
// HEADER is not voter data, so it is safe in git — no row values ever are
// (candidate/voter-file-plan.md §2). This fixture is what makes the mapping a
// regression guard instead of a one-time hand-check: this export is the source
// the `primary-regulars` SMS preset needs, and every failure mode below is
// SILENT — the adapter would resolve, ingest, and write a useless overlay.

const RNC_HEADERS = [
  "rnc_reg_id", "state_voter_id", "first_name", "last_name",
  "registration_address_1", "registration_address_2", "registration_address_city",
  "registration_address_state", "registration_address_zip_5", "household_id",
  "age", "age_range", "sex", "ethnicity_reported", "ethnic_group_name_modeled",
  "education_modeled", "congressional_district", "state_leg_upper_district",
  "state_leg_lower_district", "mailing_address_1", "mailing_address_2",
  "mailing_address_city", "mailing_address_state", "mailing_address_zip_5",
  "county_name", "precinct_name", "media_market", "metro_type",
  "rnc_calc_party", "official_party", "registered_party_roll_up",
  "voter_frequency_general", "voter_frequency_primary", "turnout_general_score",
  "cell", "landline", "registration_date", "voter_status", "permanent_absentee",
  "vh_25_g", "vh_25_p", "vh_25_mg", "vh_25_mp",
  "vh_24_g", "vh_24_p", "vh_24_pp",
  "vh_23_g", "vh_23_p", "vh_22_g", "vh_22_p", "vh_21_g", "vh_21_p",
  "vh_20_g", "vh_20_p", "vh_20_pp", "vh_19_g", "vh_19_p",
  "vh_18_g", "vh_18_p", "vh_17_g", "vh_17_p",
  "vh_16_g", "vh_16_p", "vh_16_pp",
  "numinar_id", "Do not text", "Notes", "email",
];

const at = (header: string): number => {
  const i = RNC_HEADERS.indexOf(header);
  if (i < 0) throw new Error(`fixture is missing ${header}`);
  return i;
};

describe("RNC/Numinar export mapping", () => {
  it("resolves every required field, including zip and party", () => {
    const res = resolveColumns(RNC_HEADERS);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.map.voterId).toBe(at("state_voter_id"));
    expect(res.map.zip).toBe(at("registration_address_zip_5"));
    // official_party, NOT the modeled rnc_calc_party.
    expect(res.map.party).toBe(at("official_party"));
  });

  it("maps party from official_party, never the modeled rnc_calc_party", () => {
    const res = resolveColumns(RNC_HEADERS);
    if (!res.ok) throw new Error("fixture should resolve");
    expect(res.map.party).not.toBe(at("rnc_calc_party"));
  });

  it("detects exactly the even-year August primaries, most recent first", () => {
    // Exactly MAX_PP columns, so primaryPropensity's window covers all of them —
    // and the three source files (2024/2022/2020) are all inside it.
    const cols = detectPrimaryColumns(RNC_HEADERS);
    expect(cols.map((c) => c.header)).toEqual([
      "vh_24_p", "vh_22_p", "vh_20_p", "vh_18_p", "vh_16_p",
    ]);
    expect(cols).toHaveLength(MAX_PP);
    expect(cols.map((c) => c.year)).toEqual([2024, 2022, 2020, 2018, 2016]);
  });

  it("excludes odd-year, presidential, municipal, and general columns", () => {
    const headers = detectPrimaryColumns(RNC_HEADERS).map((c) => c.header);
    // Each of these would corrupt an AUGUST-primary propensity score. The
    // odd years matter most: they are not Missouri state primaries, and
    // keeping them would push 2020 out of the MAX_PP recency window.
    for (const excluded of [
      "vh_25_p", "vh_23_p", "vh_21_p", "vh_19_p", "vh_17_p",
      "vh_24_pp", "vh_20_pp", "vh_16_pp", "vh_25_mp", "vh_25_mg", "vh_24_g",
    ]) {
      expect(headers).not.toContain(excluded);
    }
  });

  it("keeps 2020 inside the scoring window", () => {
    // The regression this guards: with odd years included the window was
    // 2025-2021 and the 2020 source file scored nothing at all.
    const res = resolveColumns(RNC_HEADERS);
    if (!res.ok) throw new Error("fixture should resolve");
    const r = Array(RNC_HEADERS.length).fill("");
    r[at("vh_20_p")] = "Voted";
    expect(primaryPropensity(r, res.primaryColumns)).toBe(1);
  });

  it("scores propensity across the three source files' primaries", () => {
    const res = resolveColumns(RNC_HEADERS);
    if (!res.ok) throw new Error("fixture should resolve");
    const r = Array(RNC_HEADERS.length).fill("");
    r[at("vh_24_p")] = "Voted";
    r[at("vh_22_p")] = "Voted";
    r[at("vh_20_p")] = "Voted";
    // Must NOT count: a presidential primary and a general.
    r[at("vh_24_pp")] = "Voted";
    r[at("vh_24_g")] = "Voted";
    expect(primaryPropensity(r, res.primaryColumns)).toBe(3);
  });

  it("counts a pulled party ballot as a vote", () => {
    // This export records WHICH ballot was pulled in some cycles. Reading
    // "Democrat Ballot" as a non-vote undercounts the most habitual voters.
    expect(votedInElection("Democrat Ballot")).toBe(true);
    expect(votedInElection("Republican Ballot")).toBe(true);
    expect(votedInElection("Voted")).toBe(true);
    expect(votedInElection("")).toBe(false);
    // Refuse, don't guess: a negation is not a vote.
    expect(votedInElection("No Ballot Pulled")).toBe(false);
  });

  it("honors the file's own 'Do not text' suppression column", () => {
    expect(detectDncColumn(RNC_HEADERS)).toBe(at("Do not text"));
  });

  it("reads cell and landline as phones, and the suppression column as neither", () => {
    const phones = detectPhoneColumns(RNC_HEADERS);
    expect(phones).toEqual([
      { index: at("cell"), header: "cell", lineType: "wireless" },
      { index: at("landline"), header: "landline", lineType: "landline" },
    ]);
  });

  it("flags a suppressed row's numbers as do-not-contact", () => {
    const res = resolveColumns(RNC_HEADERS);
    if (!res.ok) throw new Error("fixture should resolve");
    const r = Array(RNC_HEADERS.length).fill("");
    r[at("state_voter_id")] = "16548054";
    r[at("county_name")] = "ST LOUIS";
    r[at("precinct_name")] = "CREVE COEUR 34";
    r[at("registration_address_zip_5")] = "63131";
    r[at("official_party")] = "U";
    r[at("cell")] = "3145550101";
    r[at("Do not text")] = "Y";

    const mapped = mapVendorRow(r, res, { dncColumn: detectDncColumn(RNC_HEADERS) });
    expect(mapped).not.toBeNull();
    // Missouri has no party registration — "U" is the honest value here.
    expect(mapped!.party).toBe("UNA");
    expect(mapped!.phones).toHaveLength(1);
    expect(mapped!.phones[0].doNotCall).toBe(true);
  });

  it("is identified as a vendor export", () => {
    expect(detectSource(RNC_HEADERS)).toEqual({ ok: true, source: "vendorRepub" });
  });

  it("never exceeds MAX_PP", () => {
    const res = resolveColumns(RNC_HEADERS);
    if (!res.ok) throw new Error("fixture should resolve");
    const r = Array(RNC_HEADERS.length).fill("Voted");
    expect(primaryPropensity(r, res.primaryColumns)).toBe(MAX_PP);
  });
});
