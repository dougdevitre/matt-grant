// Geo-route factory. Collapses the repeated fetch→normalize→meta→fallback boilerplate
// in app/api/geo/* into one helper that emits the same { type, features, meta } shape
// those routes already return (so the map consumer keeps working unchanged).
import { NextResponse } from "next/server";
import { type Provenance } from "./resource";

export type GeoFetchResult = {
  /** Live FeatureCollection, or null/empty when the upstream has nothing usable. */
  fc: GeoJSON.FeatureCollection | null;
  /** Route-specific, dynamically-computed meta (e.g. pollingLive, districtFiltered, coverage). */
  meta?: Record<string, unknown>;
};

export type GeoRouteOpts = {
  source: string;
  fetcher: () => Promise<GeoFetchResult>;
  /** Sample/boundary data to serve when live data is unavailable (e.g. lib/mapData PRECINCTS). */
  fallback: GeoJSON.FeatureCollection;
  cacheControl?: string;
  note?: string;
};

/**
 * Build a Next.js GET handler for a geo layer. On empty/error it serves `fallback`
 * with `live:false` + a degraded reason, so the map always renders something. The
 * standardized Provenance keys (`live`, `count`, `degraded`) are always present;
 * any route-specific `meta` from the fetcher is merged on top. Pair with
 * `export const revalidate = …` in the route module for ISR.
 */
export function geoRoute(opts: GeoRouteOpts) {
  return async function GET() {
    let result: GeoFetchResult = { fc: null };
    let reason: string | undefined;
    try {
      result = await opts.fetcher();
    } catch (err) {
      reason = (err as Error)?.message ?? "fetch failed";
    }
    const fc = result.fc;
    const live = !!fc && Array.isArray(fc.features) && fc.features.length > 0;
    const out = live ? fc! : opts.fallback;
    const provenance: Provenance = {
      source: opts.source,
      kind: "geo",
      live,
      count: out.features.length,
      note: opts.note,
      ...(live ? {} : { degraded: { reason: reason ?? "showing sample data" } }),
    };
    // Route-specific meta (pollingLive, coverage, …) merges on top of the base keys.
    const meta = { ...provenance, ...(result.meta ?? {}) };
    return NextResponse.json(
      { type: "FeatureCollection", features: out.features, meta },
      { headers: { "cache-control": opts.cacheControl ?? "public, s-maxage=86400, stale-while-revalidate=43200" } },
    );
  };
}
