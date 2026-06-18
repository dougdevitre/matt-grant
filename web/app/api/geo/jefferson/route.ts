import { NextResponse } from "next/server";
import { JEFFERSON } from "@/lib/geoSources";
import { turnoutFor } from "@/lib/countyTurnout";

// Jefferson County precinct polygons (boundary-only; no turnout feed). The whole
// county is in the 2025-map MO-02, so no district clip is needed.
export const revalidate = 86400;

export async function GET() {
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
  try {
    const res = await fetch(`${JEFFERSON.url}?${params}`, {
      next: { revalidate },
      headers: { accept: "application/geo+json,application/json" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) throw new Error("empty");
    const t = turnoutFor("Jefferson");
    const features = fc.features.map((f) => ({
      ...f,
      properties: { ...f.properties, county: "Jefferson", ...(t != null ? { turnoutPct: t } : {}) },
    }));
    return NextResponse.json(
      { type: "FeatureCollection", features, meta: { live: true, count: features.length, county: "Jefferson", turnout: t } },
      { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=43200" } },
    );
  } catch {
    return NextResponse.json({ type: "FeatureCollection", features: [], meta: { live: false, count: 0, county: "Jefferson" } });
  }
}
