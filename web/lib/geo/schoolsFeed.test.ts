import { describe, it, expect } from "vitest";
import { normalizeSchoolFeature } from "./schoolsFeed";

const feat = (props: Record<string, unknown>, geometry: GeoJSON.Geometry | null = { type: "Point", coordinates: [-90.5, 38.6] }): GeoJSON.Feature =>
  ({ type: "Feature", properties: props, geometry } as GeoJSON.Feature);

describe("normalizeSchoolFeature", () => {
  it("resolves the name across common ArcGIS field spellings", () => {
    for (const key of ["SCHOOL_NAME", "Facility_Name", "NAME"]) {
      const p = normalizeSchoolFeature(feat({ [key]: "Parkway West High" }));
      expect(p?.properties).toMatchObject({ name: "Parkway West High", category: "schools", source: "live" });
    }
  });

  it("builds the note from district + city when present", () => {
    const p = normalizeSchoolFeature(feat({ NAME: "X Elem", DISTRICT_NAME: "Rockwood R-VI", CITY: "Eureka" }));
    expect(p?.properties.note).toBe("Rockwood R-VI · Eureka");
  });

  it("returns null for anything it can't confidently read (never mislabels)", () => {
    expect(normalizeSchoolFeature(feat({ SOME_OTHER_FIELD: "x" }))).toBeNull(); // no known name field
    expect(normalizeSchoolFeature(feat({ NAME: "   " }))).toBeNull(); // blank name
    expect(normalizeSchoolFeature(feat({ NAME: "X" }, { type: "Polygon", coordinates: [[[0, 0]]] }))).toBeNull(); // not a point
    expect(normalizeSchoolFeature(feat({ NAME: "X" }, { type: "Point", coordinates: [Number.NaN, 38] }))).toBeNull(); // bad coords
  });
});
