"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useResource } from "@/lib/data/useResource";
import { STATUS } from "@/lib/viz/palette";
import { matchRegionFeatures, type CoverageMapRow } from "@/lib/volunteers/coverageGeo";

// Real geometry for the coverage page: joins the coverage report's regions to the
// map's existing cached geometry routes (STL precincts, Jefferson precincts, rural
// VTDs) via lib/volunteers/coverageGeo and paints them by status — gap brick,
// covered field green, overlap gold. Regions that match no boundary are listed
// under the map, never hidden — the text list above stays the source of truth.

// Same mapping as CoverageMapCanvas (kept local on each side — a static import
// from the canvas module would drag maplibre into the SSR bundle past ssr:false).
const COVERAGE_COLOR = { gap: STATUS.bad, covered: STATUS.good, overlap: STATUS.warn } as const;

const CoverageMapCanvas = dynamic(() => import("@/components/dashboard/CoverageMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink/5 text-sm text-slate">Loading map…</div>
  ),
});

const LEGEND = [
  { key: "gap", label: "Gap — no captain" },
  { key: "covered", label: "Covered" },
  { key: "overlap", label: "Overlap" },
] as const;

export default function CoverageMap({ rows }: { rows: CoverageMapRow[] }) {
  const stl = useResource<GeoJSON.FeatureCollection>("/api/geo/precincts");
  const jefferson = useResource<GeoJSON.FeatureCollection>("/api/geo/jefferson");
  const extra = useResource<GeoJSON.FeatureCollection>("/api/geo/extra-counties");

  const loading = [stl.state, jefferson.state, extra.state].some((s) => s === "loading");
  const { features, unmatched } = useMemo(
    () => matchRegionFeatures(rows, { stl: stl.data, jefferson: jefferson.data, extra: extra.data }),
    [rows, stl.data, jefferson.data, extra.data],
  );

  // Nothing matched and nothing still loading → the feeds are down or the names
  // simply don't join. Say so instead of showing an empty map.
  if (!loading && features.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate">
        No region matched the map&rsquo;s boundary layers, so there&rsquo;s nothing to draw — region names must match a
        precinct, municipality, or county as spelled in the map feeds (e.g. &ldquo;Kirkwood&rdquo;, &ldquo;Jefferson
        County&rdquo;). The list below is unaffected.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="relative h-[50vh] min-h-[340px] overflow-hidden rounded-lg border border-line shadow-card">
        <CoverageMapCanvas features={features} />
        {loading && (
          <p className="absolute left-3 top-3 z-10 rounded-sm bg-white/85 px-2 py-1 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">
            Loading boundaries…
          </p>
        )}
        <div className="absolute bottom-3 left-3 z-10 rounded-sm bg-white/90 px-2.5 py-1.5 text-[0.7rem] text-ink shadow-card">
          {LEGEND.map((l) => (
            <span key={l.key} className="mr-3 inline-flex items-center gap-1.5 last:mr-0">
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: COVERAGE_COLOR[l.key], opacity: 0.7 }}
                aria-hidden
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      {unmatched.length > 0 && !loading && (
        <p className="mt-2 text-[0.75rem] text-slate">
          <span className="font-mono uppercase tracking-eyebrow">No geometry matched:</span>{" "}
          {unmatched.map((r) => r.name).join(" · ")} — check the spelling against the map&rsquo;s precinct,
          municipality, or county names (these regions still count in the list below).
        </p>
      )}
    </div>
  );
}
