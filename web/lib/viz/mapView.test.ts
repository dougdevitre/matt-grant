import { describe, it, expect } from "vitest";
import { bboxOfFeatureCollections, DISTRICT_FALLBACK_BOUNDS } from "./mapView";

const fc = (...features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features,
});
const point = (lng: number, lat: number): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Point", coordinates: [lng, lat] },
});
const polygon = (ring: [number, number][]): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [ring] },
});
const multiPolygon = (rings: [number, number][][]): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "MultiPolygon", coordinates: rings.map((r) => [r]) },
});

describe("bboxOfFeatureCollections", () => {
  it("spans a mix of points, polygons, and multipolygons across collections", () => {
    const b = bboxOfFeatureCollections([
      fc(point(-90.5, 38.5)),
      fc(polygon([[-90.7, 38.4], [-90.6, 38.4], [-90.6, 38.6], [-90.7, 38.4]])),
      fc(multiPolygon([[[-91.2, 38.0], [-91.0, 38.0], [-91.0, 38.2], [-91.2, 38.0]]])),
    ]);
    expect(b).toEqual([
      [-91.2, 38.0],
      [-90.5, 38.6],
    ]);
  });

  it("returns null when nothing has coordinates (empty, null, undefined)", () => {
    expect(bboxOfFeatureCollections([fc(), null, undefined])).toBeNull();
  });

  it("pads a single point into a real extent (never a zero-area box)", () => {
    const b = bboxOfFeatureCollections([fc(point(-90.5, 38.5))]);
    expect(b).not.toBeNull();
    const [[w, s], [e, n]] = b!;
    expect(e).toBeGreaterThan(w);
    expect(n).toBeGreaterThan(s);
    expect((w + e) / 2).toBeCloseTo(-90.5, 5); // padding is symmetric around the point
    expect((s + n) / 2).toBeCloseTo(38.5, 5);
  });

  it("skips non-finite coordinates instead of poisoning the box", () => {
    const bad: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [Number.NaN, Number.POSITIVE_INFINITY] },
    };
    expect(bboxOfFeatureCollections([fc(bad)])).toBeNull();
    const b = bboxOfFeatureCollections([fc(bad, point(-90.5, 38.5))]);
    expect((b![0][0] + b![1][0]) / 2).toBeCloseTo(-90.5, 5); // only the good point counted
  });
});

describe("DISTRICT_FALLBACK_BOUNDS", () => {
  it("is a well-formed west<east / south<north box", () => {
    const [[w, s], [e, n]] = DISTRICT_FALLBACK_BOUNDS;
    expect(w).toBeLessThan(e);
    expect(s).toBeLessThan(n);
  });
});
