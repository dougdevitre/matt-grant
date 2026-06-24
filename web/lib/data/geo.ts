// Geo-route factory. Collapses the repeated fetch→normalize→meta→fallback boilerplate
// in app/api/geo/* into one helper that emits the same { type, features, meta } shape
// those routes already return (so they can adopt it without changing their contract).
import { NextResponse } from "next/server";
import { type Provenance } from "./resource";

export type GeoRouteOpts = {
  source: string;
  /** Returns a live FeatureCollection, or null/empty when the upstream has nothing. */
  fetcher: () => Promise<GeoJSON.FeatureCollection | null>;
  /** Sample/boundary data to serve when live data is unavailable (e.g. lib/mapData PRECINCTS). */
  fallback: GeoJSON.FeatureCollection;
  cacheControl?: string;
  note?: string;
};

/**
 * Build a Next.js GET handler for a geo layer. On empty/error it serves `fallback`
 * with `meta.live=false` + a degraded reason, so the map always renders something.
 * Pair with `export const revalidate = …` in the route module for ISR.
 */
export function geoRoute(opts: GeoRouteOpts) {
  return async function GET() {
    let fc: GeoJSON.FeatureCollection | null = null;
    let reason: string | undefined;
    try {
      fc = await opts.fetcher();
    } catch (err) {
      reason = (err as Error)?.message ?? "fetch failed";
    }
    const live = !!fc && Array.isArray(fc.features) && fc.features.length > 0;
    const out = live ? fc! : opts.fallback;
    const meta: Provenance = {
      source: opts.source,
      kind: "geo",
      live,
      count: out.features.length,
      note: opts.note,
      ...(live ? {} : { degraded: { reason: reason ?? "showing sample data" } }),
    };
    return NextResponse.json(
      { type: "FeatureCollection", features: out.features, meta },
      { headers: { "cache-control": opts.cacheControl ?? "public, s-maxage=86400, stale-while-revalidate=43200" } },
    );
  };
}
