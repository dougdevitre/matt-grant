// District clip for STATEWIDE point layers (e.g. the DESE schools feed): the
// union of every MO-02 boundary geometry the app can fetch — St. Louis County
// precinct polygons (the 2025-map scope) + Jefferson County precincts + the
// three rural counties' Census VTDs. The existing polling clip stays on the
// STL-only geometry (its records are county-scoped already); this wider clip is
// for feeds that span the whole state.
//
// Every upstream fetch is best-effort: a failed source just contributes no
// polygons. Callers MUST treat an empty result as "cannot clip" and fall back to
// sample data — never serve a statewide layer unclipped.

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { fetchCd2Geometry } from "@/lib/precincts";
import { CENSUS_VTD, JEFFERSON } from "@/lib/geoSources";

export type ClipPolygon = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

/** Pure: the Polygon/MultiPolygon features of a collection (clip candidates). */
export function polygonsOf(fc: GeoJSON.FeatureCollection | null | undefined): ClipPolygon[] {
  return (fc?.features ?? []).filter(
    (f): f is ClipPolygon => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
  );
}

/** Pure: whether [lng, lat] falls inside ANY of the polygons. */
export function pointInAnyPolygon(polys: ClipPolygon[], coordinates: [number, number]): boolean {
  return polys.some((poly) => booleanPointInPolygon(coordinates, poly));
}

const REVALIDATE = 86400;

async function fetchBoundaryFc(url: string, params: URLSearchParams): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const res = await fetch(`${url}?${params}`, {
      next: { revalidate: REVALIDATE },
      headers: { accept: "application/geo+json,application/json" },
    });
    if (!res.ok) return null;
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    return fc?.features?.length ? fc : null;
  } catch {
    return null;
  }
}

// Geometry-only pulls (coarser maxAllowableOffset than the display routes — a
// clip mask doesn't need display fidelity, and smaller payloads cache cheaper).
const JEFFERSON_PARAMS = new URLSearchParams({
  where: "1=1",
  outFields: "",
  returnGeometry: "true",
  outSR: "4326",
  maxAllowableOffset: "0.001",
  geometryPrecision: "5",
  resultRecordCount: "2000",
  f: "geojson",
});

function vtdParams(): URLSearchParams {
  const where = Object.keys(CENSUS_VTD.counties)
    .map((f) => `GEOID LIKE '${f}%'`)
    .join(" OR ");
  return new URLSearchParams({
    where,
    outFields: "GEOID",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.001",
    geometryPrecision: "5",
    f: "geojson",
  });
}

/**
 * All MO-02 clip polygons the app can currently fetch. Sources that fail simply
 * contribute nothing; an empty array means "cannot clip today".
 */
export async function districtClipPolygons(): Promise<ClipPolygon[]> {
  const [stl, jefferson, vtds] = await Promise.all([
    fetchCd2Geometry().catch(() => null),
    fetchBoundaryFc(JEFFERSON.url, JEFFERSON_PARAMS),
    fetchBoundaryFc(CENSUS_VTD.url, vtdParams()),
  ]);
  return [...polygonsOf(stl), ...polygonsOf(jefferson), ...polygonsOf(vtds)];
}
