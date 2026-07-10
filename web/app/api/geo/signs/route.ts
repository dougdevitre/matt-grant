import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { listSignPlacements } from "@/lib/signs/store";
import { signFeature, signVerified } from "@/lib/signs/geo";

// Saved sign placements as a GeoJSON layer for the field map. Signs are internal
// field ops — unlike events there is no public subset, so a caller without the
// staff read capability gets an EMPTY collection, not an error page. Access-
// dependent output → hand-written force-dynamic route (the geoRoute() helper is
// for cacheable public layers).
export const dynamic = "force-dynamic";

export async function GET() {
  const { allowed } = await checkCap("viewTargets");
  if (!allowed) {
    return NextResponse.json(
      { type: "FeatureCollection", features: [], meta: { count: 0 } },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const rows = await listSignPlacements();
  const features = rows
    .filter((r): r is typeof r & { lat: number; lng: number } => r.lat != null && r.lng != null)
    .map(signFeature);

  return NextResponse.json(
    {
      type: "FeatureCollection",
      features,
      meta: { count: features.length, verified: rows.filter(signVerified).length },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
