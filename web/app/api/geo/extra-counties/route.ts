import { NextResponse } from "next/server";
import { CENSUS_VTD } from "@/lib/geoSources";

// Census 2020 Voting Districts for the three MO-02 counties with no county GIS
// feed (Washington, Crawford, Gasconade). Boundary-only — no turnout. All three
// are wholly in the 2025-map MO-02, so no district clip is needed.
export const revalidate = 604800; // weekly — VTD boundaries are static

export async function GET() {
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
  try {
    const res = await fetch(`${CENSUS_VTD.url}?${params}`, { next: { revalidate } });
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) throw new Error("empty");
    const features = fc.features.map((f) => {
      const geoid = String((f.properties as { GEOID?: string })?.GEOID ?? "");
      const county = CENSUS_VTD.counties[geoid.slice(0, 5)] ?? "";
      return { ...f, properties: { ...f.properties, county } };
    });
    return NextResponse.json(
      { type: "FeatureCollection", features, meta: { live: true, count: features.length, counties: Object.values(CENSUS_VTD.counties) } },
      { headers: { "cache-control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ type: "FeatureCollection", features: [], meta: { live: false, count: 0 } });
  }
}
