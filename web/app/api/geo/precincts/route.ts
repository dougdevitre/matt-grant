import { geoRoute } from "@/lib/data/geo";
import { attachScores, fetchScopedPrecincts, scoreRows } from "@/lib/precincts";
import { PRECINCTS } from "@/lib/mapData";
import { listVoterAggs } from "@/lib/voters/store";
import { enrichmentByMapName } from "@/lib/voters/enrich";

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
    let features = attachScores(r.features, scored);
    // Voter-engine enrichment (voter-file-plan.md Phase 3): join the ingested
    // per-precinct rollups by name and stamp the heuristic primary propensity +
    // universe counts. Best-effort — no ingest yet (or any error) leaves the
    // features exactly as before, and the propensity map mode stays disabled.
    let voterJoin: { hitRate: number; matched: number } | undefined;
    try {
      const aggs = await listVoterAggs();
      if (aggs.length) {
        const names = features.map((f) => String((f.properties as { name?: string })?.name ?? ""));
        const join = enrichmentByMapName(aggs, names);
        voterJoin = { hitRate: Math.round(join.hitRate * 100) / 100, matched: join.byName.size };
        features = features.map((f) => {
          const e = join.byName.get(String((f.properties as { name?: string })?.name ?? ""));
          return e
            ? { ...f, properties: { ...f.properties, vPropensity: e.vPropensity, persuade: e.persuade, mobilize: e.mobilize, bank: e.bank } }
            : f;
        });
      }
    } catch {
      /* enrichment is additive only */
    }
    const withTurnout = features.filter(
      (f) => (f.properties as { turnout?: number | null })?.turnout != null,
    ).length;
    return {
      fc: { type: "FeatureCollection", features },
      meta: { scope: r.scope, withTurnout, scoredWith: "votes", ...(voterJoin ? { voterJoin } : {}) },
    };
  },
});
