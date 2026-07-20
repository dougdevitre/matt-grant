import { describe, it, expect } from "vitest";
import {
  SCHOOL_DISTRICT_DATA_READY,
  districtById,
  districtsForZip,
  districtForZipUnambiguous,
} from "./school-districts";
import type { SchoolDistrictDataFile } from "./school-districts.data";

// Synthetic fixture — the shipped data file is EMPTY by design (no district name
// is hand-typed; see the generator + provenance rules in school-districts.data.ts).
const FIXTURE: SchoolDistrictDataFile = {
  source: { generator: "test", leaCountyFile: "a", leaZctaFile: "b", retrievedAt: "2026-07-20", urls: [] },
  districts: {
    "2900001": { name: "Fixture District One", counties: ["st-louis"] },
    "2900002": { name: "Fixture District Two", counties: ["st-louis", "franklin"] },
  },
  zipToDistricts: {
    "63001": ["2900001"], // certain
    "63002": ["2900001", "2900002"], // ambiguous — crosses district lines
  },
};

describe("school-districts crosswalk", () => {
  it("ships EMPTY until the sourced crosswalk is generated — nothing is guessed", () => {
    expect(SCHOOL_DISTRICT_DATA_READY).toBe(false);
    expect(districtsForZip("63011")).toEqual([]);
    expect(districtForZipUnambiguous("63011")).toBeNull();
    expect(districtById("2900001")).toBeNull();
  });

  it("resolves districts by id and by ZIP from generated data", () => {
    expect(districtById("2900002", FIXTURE)?.name).toBe("Fixture District Two");
    expect(districtsForZip("63001", FIXTURE).map((d) => d.id)).toEqual(["2900001"]);
    expect(districtsForZip("99999", FIXTURE)).toEqual([]);
  });

  it("an ambiguous ZIP is never presented as certain", () => {
    expect(districtsForZip("63002", FIXTURE)).toHaveLength(2);
    expect(districtForZipUnambiguous("63002", FIXTURE)).toBeNull();
    expect(districtForZipUnambiguous("63001", FIXTURE)).toBe("2900001");
  });
});
