import { describe, expect, it } from "vitest";
import { ageBand, assembleAddress, isCd2, parseLastVoted, parseRegDate, parseVoterRow, validateHeader, COLUMNS } from "./parse";
import { isNewRegistrant, scoreVoter, segmentFor, supportProxy, turnoutScore, SEGMENTS } from "./score";
import { buildCrosswalk, normalizePrecinct, precinctKey } from "./crosswalk";

// SYNTHETIC fixture only — never real voter rows (voter-file-plan.md §2).
const row = (over: Partial<Record<number, unknown>> = {}): unknown[] => {
  const r: unknown[] = new Array(COLUMNS.length).fill("");
  r[0] = "St. Louis"; r[1] = 123456; r[2] = "Testy"; r[4] = "McTestface";
  r[7] = 42; r[10] = "SAMPLE"; r[11] = "DR";
  r[15] = "BALLWIN"; r[16] = "MO"; r[17] = 63011;
  r[22] = 1970; r[24] = new Date("2010-05-04T00:00:00Z");
  r[25] = "123"; r[26] = "QUEENY 12"; r[31] = "25 CN 2";
  r[34] = "Active"; r[35] = "11/05/2024 General";
  for (const [k, v] of Object.entries(over)) r[Number(k)] = v;
  return r;
};

describe("parse", () => {
  it("parses a full row: address assembly, yob, district coding, last vote", () => {
    const v = parseVoterRow(row())!;
    expect(v).toMatchObject({
      voterId: "123456",
      county: "St. Louis",
      address: "42 SAMPLE DR",
      city: "BALLWIN",
      zip: "63011",
      yob: 1970,
      regDate: "2010-05-04",
      precinctName: "QUEENY 12",
      inDistrict: true,
      active: true,
    });
    expect(v.lastVoted).toEqual({ date: "2024-11-05", year: 2024, label: "General" });
    expect(v.party).toBeUndefined(); // blank party (the ~90% case)
  });

  it("rejects rows missing the identity minimum, tolerates bad cells", () => {
    expect(parseVoterRow(row({ 1: "" }))).toBeNull();
    const v = parseVoterRow(row({ 22: "n/a", 35: "garbage", 34: "Inactive" }))!;
    expect(v.yob).toBeNull();
    expect(v.lastVoted).toBeNull();
    expect(v.active).toBe(false);
  });

  it("handles non-standard addresses, units, and mailing address", () => {
    expect(assembleAddress(row({ 6: "RURAL ROUTE 1 BOX 5" }))).toEqual({ address: "RURAL ROUTE 1 BOX 5" });
    const v = parseVoterRow(row({ 13: "APT", 14: "4B", 18: "PO BOX 9", 19: "EUREKA", 20: "MO", 21: 63025 }))!;
    expect(v.unit).toBe("APT 4B");
    expect(v.mailingAddress).toBe("PO BOX 9, EUREKA, MO, 63025");
  });

  it("parses history and dates defensively", () => {
    expect(parseLastVoted("04/07/2026 Municipal General")).toEqual({ date: "2026-04-07", year: 2026, label: "Municipal General" });
    expect(parseLastVoted("")).toBeNull();
    expect(parseRegDate("11/6/2024")).toBe("2024-11-06");
    expect(parseRegDate("2020-01-15T00:00:00")).toBe("2020-01-15");
  });

  it("codes districts and age bands", () => {
    expect(isCd2("25 CN 2")).toBe(true);
    expect(isCd2("25 CN 3")).toBe(false);
    expect(ageBand(2004)).toBe("18-24");
    expect(ageBand(1970)).toBe("50-64");
    expect(ageBand(null)).toBe("unknown");
  });

  it("validateHeader accepts the real header (+ extra trailing cols) and flags drift", () => {
    expect(validateHeader([...COLUMNS])).toEqual([]);
    // Case/whitespace-insensitive, and extra trailing columns are allowed.
    expect(validateHeader([...COLUMNS.map((c) => `  ${c.toUpperCase()} `), "EXTRA"])).toEqual([]);
    // A reordered column is caught (index-based parsing would mis-read every row).
    const swapped = [...COLUMNS];
    [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
    expect(validateHeader(swapped).length).toBeGreaterThan(0);
    // A short header (missing columns) is caught.
    expect(validateHeader(COLUMNS.slice(0, 10)).some((p) => /expected at least/.test(p))).toBe(true);
  });
});

describe("score", () => {
  it("T keys on recency; Inactive overrides", () => {
    expect(turnoutScore({ date: "2026-04-07", year: 2026, label: "Municipal General" }, true)).toBe(5);
    expect(turnoutScore({ date: "2024-11-05", year: 2024, label: "General" }, true)).toBe(4);
    expect(turnoutScore({ date: "2020-11-03", year: 2020, label: "General" }, true)).toBe(3);
    expect(turnoutScore({ date: "2016-11-08", year: 2016, label: "General" }, true)).toBe(2);
    expect(turnoutScore(null, true)).toBe(1);
    expect(turnoutScore({ date: "2026-04-07", year: 2026, label: "x" }, false)).toBe(0);
  });

  it("S proxy: explicit party, neutral middle for the blank majority", () => {
    expect(supportProxy("Republican")).toBe(3);
    expect(supportProxy("Libertarian")).toBe(2);
    expect(supportProxy(undefined)).toBe(1);
    expect(supportProxy("Unaffiliated")).toBe(1);
    expect(supportProxy("Democratic")).toBe(0);
  });

  it("the targeting matrix covers every T×S cell", () => {
    expect(segmentFor(5, 3)).toBe("BANK");
    expect(segmentFor(2, 3)).toBe("MOBILIZE");
    expect(segmentFor(4, 1)).toBe("PERSUADE");
    expect(segmentFor(1, 1)).toBe("PROSPECT");
    expect(segmentFor(4, 0)).toBe("MONITOR");
    expect(segmentFor(0, 3)).toBe("MONITOR");
    for (let t = 0; t <= 5; t++) for (let s = 0; s <= 3; s++) expect(SEGMENTS).toContain(segmentFor(t, s));
  });

  it("scoreVoter composes and flags new registrants", () => {
    expect(isNewRegistrant("2025-01-02")).toBe(true);
    expect(isNewRegistrant("2024-11-05")).toBe(false);
    const v = scoreVoter(parseVoterRow(row({ 23: "Republican", 35: "04/08/2025 Municipal General" }))!);
    expect(v).toMatchObject({ t: 5, s: 3, segment: "BANK", newRegistrant: false });
  });
});

describe("crosswalk", () => {
  it("normalizes clerk-style labels", () => {
    expect(normalizePrecinct("QUEENY 12")).toBe("queeny 12");
    expect(normalizePrecinct("Ward 03 - Pct. 07")).toBe("ward 3 pct 7");
    expect(precinctKey("St. Louis", "QUEENY 12")).toBe("st louis#queeny 12");
    expect(precinctKey("Jefferson", "")).toBe("jefferson#unknown");
  });

  it("matches exact-normalized, then unambiguous containment; reports misses", () => {
    const res = buildCrosswalk(
      ["QUEENY 12", "Ward 03 - Pct. 07", "MYSTERY 99", "queeny 12"],
      ["Queeny 12", "W3P7 ward 3 pct 7 area", "Other 1"],
    );
    expect(res.matched.get("queeny 12")).toBe("Queeny 12");
    expect(res.matched.get("ward 3 pct 7")).toBe("W3P7 ward 3 pct 7 area");
    expect(res.misses).toEqual(["mystery 99"]);
    expect(res.hitRate).toBeCloseTo(2 / 3);
  });
});
