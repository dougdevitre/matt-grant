// Camera-fit helpers for the field map — pure, unit-tested. MapLibre's fitBounds
// wants [[west, south], [east, north]]; these derive that from whatever GeoJSON the
// map is actually showing, so "fit to district" tracks real data instead of a
// hardcoded frame.

export type Bounds = [[number, number], [number, number]]; // [[w, s], [e, n]]

// Generous MO-02 framing fallback (St. Louis County portion + Jefferson, Washington,
// Crawford, Gasconade). Camera framing ONLY — not authoritative district geometry;
// the live fit replaces it as soon as real features arrive.
export const DISTRICT_FALLBACK_BOUNDS: Bounds = [
  [-91.65, 37.55],
  [-90.15, 38.95],
];

type Acc = { w: number; s: number; e: number; n: number; any: boolean };

// Coordinate arrays nest differently per geometry type (Point 1 level, MultiPolygon 4);
// a recursive walk covers them all without a per-type switch. GeometryCollections have
// no `coordinates` and are skipped by the caller.
function walk(coords: unknown, acc: Acc): void {
  if (!Array.isArray(coords)) return;
  if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    const lng = coords[0] as number;
    const lat = coords[1] as number;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (lng < acc.w) acc.w = lng;
    if (lng > acc.e) acc.e = lng;
    if (lat < acc.s) acc.s = lat;
    if (lat > acc.n) acc.n = lat;
    acc.any = true;
    return;
  }
  for (const c of coords) walk(c, acc);
}

/**
 * Bounding box across every feature of every collection; null when nothing has
 * coordinates. A degenerate (single-point / zero-area) box is padded ~0.01° per axis
 * so fitBounds always gets a real extent to frame.
 */
export function bboxOfFeatureCollections(
  fcs: Array<GeoJSON.FeatureCollection | null | undefined>,
): Bounds | null {
  const acc: Acc = { w: Infinity, s: Infinity, e: -Infinity, n: -Infinity, any: false };
  for (const fc of fcs) {
    for (const f of fc?.features ?? []) {
      const g = f.geometry as (GeoJSON.Geometry & { coordinates?: unknown }) | null;
      if (g && "coordinates" in g) walk(g.coordinates, acc);
    }
  }
  if (!acc.any) return null;
  const PAD = 0.01;
  if (acc.e - acc.w < PAD) {
    acc.w -= PAD;
    acc.e += PAD;
  }
  if (acc.n - acc.s < PAD) {
    acc.s -= PAD;
    acc.n += PAD;
  }
  return [
    [acc.w, acc.s],
    [acc.e, acc.n],
  ];
}
