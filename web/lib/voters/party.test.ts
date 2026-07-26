import { describe, expect, it } from "vitest";
import { VOTER_PARTY_CODES, isVoterPartyCode, normalizePartyCode } from "./party";

describe("normalizePartyCode", () => {
  it("maps the common Republican spellings", () => {
    for (const v of ["R", "r", "REP", "Rep", "Republican", "REPUBLICAN", "GOP"]) {
      expect(normalizePartyCode(v)).toBe("REP");
    }
  });

  it("maps the common Democratic spellings", () => {
    for (const v of ["D", "DEM", "Democrat", "Democratic"]) {
      expect(normalizePartyCode(v)).toBe("DEM");
    }
  });

  it("maps unaffiliated / independent to UNA", () => {
    for (const v of ["U", "UNA", "Unaffiliated", "I", "IND", "Independent", "NPA", "None"]) {
      expect(normalizePartyCode(v)).toBe("UNA");
    }
  });

  it("maps minor parties to OTH", () => {
    for (const v of ["L", "Libertarian", "Green", "Constitution"]) {
      expect(normalizePartyCode(v)).toBe("OTH");
    }
  });

  it("returns null for blank/absent — an unknown party is NOT 'other'", () => {
    // The official Missouri file leaves this blank for ~90% of rows. Collapsing
    // blank into OTH would let a party filter sweep up the entire unknown mass.
    expect(normalizePartyCode("")).toBeNull();
    expect(normalizePartyCode("   ")).toBeNull();
    expect(normalizePartyCode(null)).toBeNull();
    expect(normalizePartyCode(undefined)).toBeNull();
  });

  it("falls back to OTH for an unrecognized non-empty value", () => {
    expect(normalizePartyCode("Whig")).toBe("OTH");
  });
});

describe("isVoterPartyCode", () => {
  it("accepts every canonical code and rejects raw input", () => {
    for (const c of VOTER_PARTY_CODES) expect(isVoterPartyCode(c)).toBe(true);
    expect(isVoterPartyCode("Republican")).toBe(false);
    expect(isVoterPartyCode("rep")).toBe(false);
    expect(isVoterPartyCode("")).toBe(false);
  });
});
