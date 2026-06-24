import { geoRoute } from "@/lib/data/geo";
import { CENSUS_VTD } from "@/lib/geoSources";
import { turnoutFor } from "@/lib/countyTurnout";

// Census 2020 Voting Districts for the three MO-02 counties with no county GIS
// feed (Washington, Crawford, Gasconade). Boundary-only — no turnout. All three
// are wholly in the 2025-map MO-02, so no district clip is needed.
export const revalidate = 604800; // weekly — VTD boundaries are static

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export const GET = geoRoute({
  source: "Rural counties (Census 2020 VTDs)",
  fallback: EMPTY,
  cacheControl: "public, s-maxage=604800, stale-while-revalidate=86400",
  fetcher: async () => {
    const fips = Object.keys(CENSUS_VTD.counties);
    const where = fips.map((f) => `GEOID LIKE '${f}%'`).join(" OR ");
    const params = new URLSearchParams({
      where,
      outFields: "GEOID,NAME",
      returnGeometry: "true",
      outSR: "4326",
      maxAllowableOffset: "0.001",
      geometryPrecision: "5",
      f: "geojson",
    });
    const res = await fetch(`${CENSUS_VTD.url}?${params}`, { next: { revalidate } });
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) return { fc: null };
    const features = fc.features.map((f) => {
      const geoid = String((f.properties as { GEOID?: string })?.GEOID ?? "");
      const county = CENSUS_VTD.counties[geoid.slice(0, 5)] ?? "";
      const t = turnoutFor(county);
      return { ...f, properties: { ...f.properties, county, ...(t != null ? { turnoutPct: t } : {}) } };
    });
    return {
      fc: { type: "FeatureCollection", features },
      meta: { counties: Object.values(CENSUS_VTD.counties) },
    };
  },
});
