import { describe, expect, it } from "vitest";
import {
  matchRegionFeatures,
  normalizeRegionName,
  STL_PORTION_NOTE,
  type CoverageMapRow,
} from "./coverageGeo";

const row = (name: string, over: Partial<CoverageMapRow> = {}): CoverageMapRow => ({
  name,
  level: "City / Township",
  status: "gap",
  captains: "Unassigned",
  teamSize: 0,
  ...over,
});

const poly = (props: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  properties: props,
});

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

// STL precincts carry name+municipality; jefferson Precinct+county; extra NAME+county.
const stl = fc([
  poly({ name: "KIR 1", municipality: "Kirkwood" }),
  poly({ name: "KIR 2", municipality: "Kirkwood" }),
  poly({ name: "BAL 7", municipality: "Ballwin" }),
]);
const jefferson = fc([
  poly({ Precinct: "Arnold 3", county: "Jefferson" }),
  poly({ Precinct: "Hillsboro 1", county: "Jefferson" }),
]);
const extra = fc([poly({ NAME: "Potosi VTD", county: "Washington" })]);

describe("normalizeRegionName", () => {
  it("bridges the common spelling variants", () => {
    expect(normalizeRegionName("St. Louis County")).toBe("st louis");
    expect(normalizeRegionName("Saint Louis")).toBe("st louis");
    expect(normalizeRegionName("  Washington   County ")).toBe("washington");
    expect(normalizeRegionName("Kirkwood")).toBe("kirkwood");
  });
});

describe("matchRegionFeatures", () => {
  it("matches precincts, municipalities, and counties by normalized name", () => {
    const rows = [
      row("KIR 1", { level: "Precinct", status: "covered" }),
      row("Kirkwood", { status: "overlap", captains: "Ann (4) · Bo (2)", teamSize: 6 }),
      row("Jefferson County", { level: "County", status: "covered" }),
      row("Nowhere Ville"),
    ];
    const res = matchRegionFeatures(rows, { stl, jefferson, extra });

    // KIR 1 claimed at precinct level; Kirkwood's municipality group keeps only KIR 2.
    const kir1 = res.features.filter((f) => f.properties?.regionName === "KIR 1");
    const kirkwood = res.features.filter((f) => f.properties?.regionName === "Kirkwood");
    expect(kir1).toHaveLength(1);
    expect(kir1[0].properties?.coverage).toBe("covered");
    expect(kirkwood).toHaveLength(1);
    expect(kirkwood[0].properties).toMatchObject({ coverage: "overlap", captains: "Ann (4) · Bo (2)", teamSize: 6 });

    const jeff = res.features.filter((f) => f.properties?.regionName === "Jefferson County");
    expect(jeff).toHaveLength(2);

    expect(res.unmatched.map((r) => r.name)).toEqual(["Nowhere Ville"]);
    expect(res.matched).toHaveLength(3);
  });

  it("precinct claim wins regardless of row order (precedence passes, not row order)", () => {
    const rows = [row("Kirkwood"), row("KIR 1", { level: "Precinct", status: "covered" })];
    const res = matchRegionFeatures(rows, { stl, jefferson: null, extra: null });
    const kir1 = res.features.filter((f) => f.properties?.regionName === "KIR 1");
    expect(kir1).toHaveLength(1);
    expect(res.features.filter((f) => f.properties?.regionName === "Kirkwood")).toHaveLength(1);
  });

  it("special-cases St. Louis County to the unclaimed STL features, labeled as the portion", () => {
    const rows = [row("Ballwin", { status: "covered" }), row("St. Louis County", { level: "County" })];
    const res = matchRegionFeatures(rows, { stl, jefferson, extra });
    const stlCounty = res.features.filter((f) => f.properties?.regionName === "St. Louis County");
    // Ballwin claimed BAL 7; the county sweep gets the two Kirkwood precincts.
    expect(stlCounty).toHaveLength(2);
    expect(stlCounty.every((f) => f.properties?.portion === STL_PORTION_NOTE)).toBe(true);
  });

  it("never mutates input features and handles missing layers", () => {
    const before = JSON.stringify(stl);
    const res = matchRegionFeatures([row("Washington County")], { stl, jefferson: null, extra });
    expect(JSON.stringify(stl)).toBe(before);
    expect(res.features).toHaveLength(1);
    expect(res.features[0].properties?.county).toBe("Washington"); // original props preserved
    expect(matchRegionFeatures([row("Anything")], { stl: null, jefferson: null, extra: null }).unmatched).toHaveLength(1);
  });
});
