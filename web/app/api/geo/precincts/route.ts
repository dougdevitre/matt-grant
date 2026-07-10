import { geoRoute } from "@/lib/data/geo";
import { attachScores, fetchScopedPrecincts, scoreRows } from "@/lib/precincts";
import { PRECINCTS } from "@/lib/mapData";

// Real MO-02 precinct columns: membership = 2025 enacted map (congress25),
// turnout = Aug 2024 primary joined by precinct code. See lib/precincts.ts.
// On no-live, geoRoute serves the sample PRECINCTS with live:false.
export const revalidate = 86400;

export const GET = geoRoute({
  source: "MO-02 2025 map · Aug 2024 primary turnout",
  fallback: PRECINCTS,
  cacheControl: "public, s-maxage=86400, stale-while-revalidate=43200",
  fetcher: async () => {
    const r = await fetchScopedPrecincts({ geometry: true });
    if (!r.live || r.features.length === 0) return { fc: null, meta: { scope: r.scope } };
    // Stamp the Targets-page ranking (scoreRows, "votes" strategy) onto the
    // features so the map's tier/GOTV modes match /dashboard/targets exactly.
    const { scored } = scoreRows(r.rows, "votes");
    const features = attachScores(r.features, scored);
    const withTurnout = features.filter(
      (f) => (f.properties as { turnout?: number | null })?.turnout != null,
    ).length;
    return {
      fc: { type: "FeatureCollection", features },
      meta: { scope: r.scope, withTurnout, scoredWith: "votes" },
    };
  },
});
