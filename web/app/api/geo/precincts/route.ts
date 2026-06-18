import { NextResponse } from "next/server";
import { fetchScopedPrecincts } from "@/lib/precincts";
import { PRECINCTS } from "@/lib/mapData";

// Real MO-02 precinct columns: membership = 2025 enacted map (congress25),
// turnout = Aug 2024 primary joined by precinct code. See lib/precincts.ts.
export const revalidate = 86400;

export async function GET() {
  const r = await fetchScopedPrecincts({ geometry: true });
  if (!r.live || r.features.length === 0) {
    return NextResponse.json({ ...PRECINCTS, meta: { live: false, count: PRECINCTS.features.length } });
  }
  const withTurnout = r.features.filter((f) => (f.properties as { turnout?: number | null })?.turnout != null).length;
  return NextResponse.json(
    {
      type: "FeatureCollection",
      features: r.features,
      meta: {
        live: true,
        scope: r.scope,
        source: "MO-02 2025 map · Aug 2024 primary turnout",
        count: r.features.length,
        withTurnout,
      },
    },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=43200" } },
  );
}
