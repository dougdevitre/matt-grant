import { describe, it, expect } from "vitest";
import { resolveDistrict, districtLabel, allDistrictKeys, countyOf, normPlace } from "./districts";

describe("resolveDistrict", () => {
  it("maps a known MO-02 city to a place key + its county", () => {
    const d = resolveDistrict({ city: "Chesterfield" });
    expect(d).toEqual({ key: "place:chesterfield", label: "Chesterfield", kind: "place", county: "189" });
  });

  it("is case/punctuation insensitive on the city name", () => {
    expect(resolveDistrict({ city: "  TOWN AND COUNTRY " }).key).toBe("place:town and country");
  });

  it("falls back to county when only a county is given", () => {
    expect(resolveDistrict({ county: "St. Louis County" })).toMatchObject({ key: "county:189", kind: "county" });
    expect(resolveDistrict({ county: "Jefferson" }).key).toBe("county:099");
  });

  it("falls back to the district-wide key for an unknown location", () => {
    expect(resolveDistrict({ city: "Springfield" }).key).toBe("district:mo-02");
    expect(resolveDistrict({}).kind).toBe("district");
  });

  it("prefers the city match even if a (different) county is also present", () => {
    expect(resolveDistrict({ city: "Arnold", county: "St. Louis County" })).toMatchObject({ key: "place:arnold", county: "099" });
  });
});

describe("districtLabel / countyOf / allDistrictKeys", () => {
  it("labels county and place keys", () => {
    expect(districtLabel("county:099")).toBe("Jefferson County");
    expect(districtLabel("place:kirkwood")).toBe("Kirkwood");
    expect(districtLabel("district:mo-02")).toBe("MO-02 (district-wide)");
  });

  it("countyOf resolves a place to its home county", () => {
    expect(countyOf("place:chesterfield")).toBe("189");
    expect(countyOf("county:221")).toBe("221");
    expect(countyOf("district:mo-02")).toBe("");
  });

  it("seeds the district-wide key + every county + every city", () => {
    const keys = allDistrictKeys();
    expect(keys).toContain("district:mo-02");
    expect(keys).toContain("county:189");
    expect(keys).toContain("place:chesterfield");
    // no duplicates
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("normPlace", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normPlace("St. Louis  County")).toBe("st louis county");
  });
});
