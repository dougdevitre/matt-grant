import { NextResponse } from "next/server";
import { PRECINCT_SOURCE } from "@/lib/geoSources";
import { PRECINCTS } from "@/lib/mapData";

// Real MO-02 PRIMARY turnout (Aug 6 2024) per precinct from St. Louis County.
// Turnout isn't stored directly, so we derive it: TOTAL_CHECKINS / RV_COUNT.
export const revalidate = 86400;

function liveUrl(): string {
  const params = new URLSearchParams({
    where: PRECINCT_SOURCE.where,
    outFields: "precinct,municipality,TOTAL_CHECKINS,RV_COUNT",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.0004", // generalize ~30m to keep payload light
    geometryPrecision: "5",
    resultRecordCount: "2000",
    f: "geojson",
  });
  return `${PRECINCT_SOURCE.url}?${params.toString()}`;
}

export async function GET() {
  try {
    const res = await fetch(liveUrl(), {
      next: { revalidate },
      headers: { accept: "application/geo+json,application/json" },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const fc = (await res.json()) as GeoJSON.FeatureCollection;
    if (!fc?.features?.length) throw new Error("empty");

    let withData = 0;
    const features = fc.features.map((f) => {
      const p = (f.properties ?? {}) as Record<string, number | string | null>;
      const rv = Number(p.RV_COUNT) || 0;
      const ci = p.TOTAL_CHECKINS == null ? null : Number(p.TOTAL_CHECKINS);
      const turnout = rv > 0 && ci != null ? Math.round((100 * ci) / rv) : null;
      if (turnout != null) withData++;
      return {
        type: "Feature" as const,
        properties: {
          name: String(p.precinct ?? "Precinct"),
          municipality: String(p.municipality ?? "").trim(),
          turnout, // raw % (Nov 2024 general); may exceed 100 on data quirks
          registered: rv || null,
          checkins: ci,
        },
        geometry: f.geometry,
      };
    });

    return NextResponse.json(
      {
        type: "FeatureCollection",
        features,
        meta: { live: true, source: PRECINCT_SOURCE.label, count: features.length, withTurnout: withData },
      },
      { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=43200" } },
    );
  } catch {
    // Fall back to the illustrative sample precincts.
    return NextResponse.json({ ...PRECINCTS, meta: { live: false, count: PRECINCTS.features.length } });
  }
}
