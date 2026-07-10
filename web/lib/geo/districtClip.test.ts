import { describe, it, expect } from "vitest";
import { pointInAnyPolygon, polygonsOf, type ClipPolygon } from "./districtClip";

const square = (w: number, s: number, e: number, n: number): ClipPolygon => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
});

describe("polygonsOf", () => {
  it("keeps Polygon/MultiPolygon features, drops points, tolerates null", () => {
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        square(0, 0, 1, 1),
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
      ],
    };
    expect(polygonsOf(fc)).toHaveLength(1);
    expect(polygonsOf(null)).toEqual([]);
  });
});

describe("pointInAnyPolygon", () => {
  const polys = [square(-91, 38, -90.5, 38.5), square(-90.4, 38.6, -90.0, 39.0)];

  it("true inside either polygon, false outside all", () => {
    expect(pointInAnyPolygon(polys, [-90.7, 38.2])).toBe(true); // first square
    expect(pointInAnyPolygon(polys, [-90.2, 38.8])).toBe(true); // second square
    expect(pointInAnyPolygon(polys, [-92.5, 37.0])).toBe(false); // neither
    expect(pointInAnyPolygon([], [-90.7, 38.2])).toBe(false); // no polygons → never inside
  });
});
