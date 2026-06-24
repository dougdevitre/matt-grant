import { geoRoute } from "@/lib/data/geo";
import { JEFFERSON } from "@/lib/geoSources";
import { turnoutFor } from "@/lib/countyTurnout";

// Jefferson County precinct polygons (boundary-only; no turnout feed). The whole
// county is in the 2025-map MO-02, so no district clip is needed. No live data →
// geoRoute serves an empty FeatureCollection with live:false.
export const revalidate = 86400;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const GET = geoRoute({
  source: "Jefferson County precincts",
  fallback: EMPTY,
  cacheControl: "public, s-maxage=86400, stale-while-revalidate=43200",
  fetcher: async () => {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "Precinct,PrecinctCode",
      returnGeometry: "true",
      outSR: "4326",
      maxAllowableOffset: "0.0005",
      geometryPrecision: "5",
      resultRecordCount: "2000",
      f: "geojson",
    });
    const res = await fetch(`${JEFFERSON.url}?${params}`, {
      next: { revalidate },
      headers: { accept: "application/geo+json,application/json" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) return { fc: null };
    const t = turnoutFor("Jefferson");
    const features = fc.features.map((f) => ({
      ...f,
      properties: { ...f.properties, county: "Jefferson", ...(t != null ? { turnoutPct: t } : {}) },
    }));
    return { fc: { type: "FeatureCollection", features }, meta: { county: "Jefferson", turnout: t } };
  },
});
