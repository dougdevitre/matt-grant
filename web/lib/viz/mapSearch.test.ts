import { describe, it, expect } from "vitest";
import { buildSearchIndex, searchEntries } from "./mapSearch";

const point = (props: Record<string, unknown>, lng = -90.5, lat = 38.5): GeoJSON.Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [lng, lat] },
});
const poly = (props: Record<string, unknown>, ring: [number, number][]): GeoJSON.Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Polygon", coordinates: [ring] },
});
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const empty = fc([]);

const layers = {
  precincts: fc([
    poly({ name: "CHE-101", municipality: "Chesterfield" }, [[-90.6, 38.6], [-90.58, 38.6], [-90.58, 38.62], [-90.6, 38.6]]),
    poly({ name: "CHE-102", municipality: "Chesterfield" }, [[-90.66, 38.64], [-90.64, 38.64], [-90.64, 38.66], [-90.66, 38.64]]),
    poly({ name: "BAL-201", municipality: "Ballwin" }, [[-90.55, 38.58], [-90.53, 38.58], [-90.53, 38.6], [-90.55, 38.58]]),
  ]),
  pois: fc([point({ name: "Daniel Boone Library", category: "polling", note: "Ellisville" })]),
  events: fc([point({ title: "Chesterfield Town Hall", locationName: "Rec center" })]),
  jefferson: fc([poly({ county: "Jefferson", Precinct: "P1" }, [[-90.6, 38.2], [-90.5, 38.2], [-90.5, 38.3], [-90.6, 38.2]])]),
  extra: empty,
};

describe("buildSearchIndex", () => {
  const index = buildSearchIndex(layers);

  it("emits precincts, synthesized municipalities, POIs, events, and counties", () => {
    const kinds = new Set(index.map((e) => e.kind));
    expect(kinds).toEqual(new Set(["precinct", "municipality", "polling place", "event", "county"]));
  });

  it("groups municipalities across their precincts, unioning the bounds", () => {
    const che = index.find((e) => e.kind === "municipality" && e.label === "Chesterfield")!;
    expect(che.sublabel).toBe("2 precincts");
    const [[w, s], [e, n]] = che.bounds;
    expect(w).toBe(-90.66); // spans both CHE precinct polygons
    expect(e).toBe(-90.58);
    expect(s).toBe(38.6);
    expect(n).toBe(38.66);
  });

  it("precinct entries carry a featureId for the map pulse; point entries get padded bounds", () => {
    const p = index.find((e) => e.kind === "precinct" && e.label === "CHE-101")!;
    expect(p.featureId).toBe("CHE-101");
    const lib = index.find((e) => e.kind === "polling place")!;
    expect(lib.bounds[1][0]).toBeGreaterThan(lib.bounds[0][0]); // padded, not zero-area
  });
});

describe("searchEntries", () => {
  const index = buildSearchIndex(layers);

  it("ranks label-prefix over word-prefix over substring", () => {
    // "che" → Chesterfield (label prefix) before CHE-101/102 (also label prefix,
    // but municipality kind outranks precinct on the tie).
    const r = searchEntries(index, "che");
    expect(r[0].label).toBe("Chesterfield");
    expect(r[1].kind).toBe("precinct");
    // "town" is a word-prefix inside the event title — still found.
    expect(searchEntries(index, "town")[0].label).toBe("Chesterfield Town Hall");
    // "boone" is a word-prefix; "oone" only a substring — both find the library.
    expect(searchEntries(index, "boone")[0].label).toBe("Daniel Boone Library");
    expect(searchEntries(index, "oone")[0].label).toBe("Daniel Boone Library");
  });

  it("returns nothing for empty/whitespace queries and respects the limit", () => {
    expect(searchEntries(index, "   ")).toEqual([]);
    expect(searchEntries(index, "e", 2)).toHaveLength(2);
  });

  it("finds counties", () => {
    expect(searchEntries(index, "jeff")[0].label).toBe("Jefferson County");
  });
});
