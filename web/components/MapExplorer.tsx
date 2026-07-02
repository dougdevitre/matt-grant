"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CATEGORIES, EVENT_COLOR, POIS, PRECINCTS, type Category } from "@/lib/mapData";
import { useResource } from "@/lib/data/useResource";
import { TURNOUT_LEGEND_GRADIENT } from "@/lib/viz/palette";

// MapLibre touches window/WebGL — load client-only.
const RegionMap3D = dynamic(() => import("@/components/RegionMap3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink/5 text-sm text-slate">Loading 3D map…</div>
  ),
});

const ALL: Category[] = ["schools", "public", "partners", "polling"];

const sampleFC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: POIS.map((p) => ({
    type: "Feature",
    properties: { name: p.name, category: p.category, note: p.note ?? "" },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  })),
};
const emptyFC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// Geo-layer meta carries route-specific keys on top of the base Provenance.
type GeoMeta = { live?: boolean; count?: number; pollingLive?: boolean };

export function MapExplorer() {
  const [visible, setVisible] = useState<Category[]>(ALL);
  const [buildings, setBuildings] = useState(true);
  const [turnout, setTurnout] = useState(true);
  const [showJefferson, setShowJefferson] = useState(true);
  const [showExtra, setShowExtra] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  // The live layers, each on the shared Resource hook (loading/ready/empty/
  // degraded/error). The {type,features,meta} payload normalizes to data+meta.
  const poisRes = useResource<GeoJSON.FeatureCollection>("/api/geo/pois");
  const precinctsRes = useResource<GeoJSON.FeatureCollection>("/api/geo/precincts");
  const jeffersonRes = useResource<GeoJSON.FeatureCollection>("/api/geo/jefferson");
  const extraRes = useResource<GeoJSON.FeatureCollection>("/api/geo/extra-counties");
  const eventsRes = useResource<GeoJSON.FeatureCollection>("/api/geo/events");

  // Pass live features to the map; fall back to sample/empty until they arrive.
  const featuresOf = (
    res: { data: GeoJSON.FeatureCollection | null },
    fallback: GeoJSON.FeatureCollection,
  ): GeoJSON.FeatureCollection => {
    const f = res.data?.features;
    return f && f.length ? { type: "FeatureCollection", features: f } : fallback;
  };

  const pois = useMemo(() => featuresOf(poisRes, sampleFC), [poisRes]);
  const precincts = useMemo(() => featuresOf(precinctsRes, PRECINCTS), [precinctsRes]);
  const jefferson = useMemo(() => featuresOf(jeffersonRes, emptyFC), [jeffersonRes]);
  const extra = useMemo(() => featuresOf(extraRes, emptyFC), [extraRes]);
  const events = useMemo(() => featuresOf(eventsRes, emptyFC), [eventsRes]);

  // Indicators: null while loading, then the live flag / count from meta.
  const pollingLive = poisRes.state === "loading" ? null : Boolean((poisRes.meta as GeoMeta | null)?.pollingLive);
  const precinctsLive = precinctsRes.state === "loading" ? null : Boolean((precinctsRes.meta as GeoMeta | null)?.live);
  const jeffCount = jeffersonRes.state === "loading" ? null : ((jeffersonRes.meta as GeoMeta | null)?.count ?? 0);
  const extraCount = extraRes.state === "loading" ? null : ((extraRes.meta as GeoMeta | null)?.count ?? 0);
  const eventCount = eventsRes.state === "loading" ? null : ((eventsRes.meta as GeoMeta | null)?.count ?? 0);

  const toggle = (c: Category) =>
    setVisible((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of pois.features) {
      const c = (f.properties?.category as string) ?? "";
      m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [pois]);
  const count = (c: Category) => counts[c] ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Controls */}
      <div className="space-y-4">
        <div className="card p-5">
          <p className="eyebrow text-slate">Layers</p>
          <ul className="mt-4 space-y-1">
            {ALL.map((c) => (
              <li key={c}>
                <label className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 hover:bg-paper">
                  <input type="checkbox" checked={visible.includes(c)} onChange={() => toggle(c)} className="sr-only peer" />
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full ring-2 ring-white"
                    style={{ background: visible.includes(c) ? CATEGORIES[c].color : "transparent", boxShadow: `0 0 0 1.5px ${CATEGORIES[c].color}` }}
                  />
                  <span className="flex-1">
                    <span className="text-sm font-semibold text-ink">{CATEGORIES[c].label}</span>
                    <span className="ml-2 font-mono text-xs text-slate">{count(c)}</span>
                    {c === "polling" && pollingLive && (
                      <span className="ml-2 rounded-sm bg-field/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field">
                        live
                      </span>
                    )}
                    {c !== "polling" && (
                      <span className="ml-2 rounded-sm bg-line px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-slate">
                        sample
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">3D blend</p>
          <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">
              Turnout columns
              {precinctsLive && (
                <span className="ml-2 rounded-sm bg-field/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field">live</span>
              )}
            </span>
            <input type="checkbox" checked={turnout} onChange={() => setTurnout((v) => !v)} />
          </label>
          <p className="mt-1 text-xs text-slate">
            {precinctsLive
              ? "Real MO-02 primary turnout (Aug 2024) — the Aug 4 electorate. Height + heat = turnout %."
              : "Height + heat = precinct turnout (loading live data…)."}
          </p>
          {turnout && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full" style={{ background: TURNOUT_LEGEND_GRADIENT }} aria-hidden />
              <div className="mt-1 flex justify-between font-mono text-[0.6rem] text-slate">
                <span>~8% low</span>
                <span>~40% high</span>
              </div>
              <p className="mt-1 text-[0.6rem] text-slate">Taller &amp; redder = higher turnout. Click a column for its numbers.</p>
            </div>
          )}
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">3D buildings</span>
            <input type="checkbox" checked={buildings} onChange={() => setBuildings((v) => !v)} />
          </label>
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">
              Jefferson Co.
              {jeffCount ? <span className="ml-2 font-mono text-xs text-slate">{jeffCount}</span> : null}
            </span>
            <input type="checkbox" checked={showJefferson} onChange={() => setShowJefferson((v) => !v)} />
          </label>
          <p className="mt-1 text-xs text-slate">Added to MO-02 in the 2025 map (boundaries only — no turnout feed).</p>
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">
              Rural cos. (VTD)
              {extraCount ? <span className="ml-2 font-mono text-xs text-slate">{extraCount}</span> : null}
            </span>
            <input type="checkbox" checked={showExtra} onChange={() => setShowExtra((v) => !v)} />
          </label>
          <p className="mt-1 text-xs text-slate">Washington, Crawford, Gasconade — Census 2020 VTDs. Zoom out to see them.</p>
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: EVENT_COLOR }} aria-hidden />
              Events
              {eventCount ? <span className="ml-2 font-mono text-xs text-slate">{eventCount}</span> : null}
            </span>
            <input type="checkbox" checked={showEvents} onChange={() => setShowEvents((v) => !v)} />
          </label>
          <p className="mt-1 text-xs text-slate">Appearances with a located address. Green = published, gold = draft; larger dot = higher priority (P1). Click a marker to open the event.</p>
          <p className="mt-3 border-t border-line pt-3 text-xs text-slate">
            Drag to pan · right-drag to tilt/rotate · scroll to zoom.
          </p>
        </div>

        <div className="card border-gold/40 bg-gold/5 p-5 text-xs text-slate">
          <p className="font-semibold text-ink">
            Live: polling {pollingLive === null ? "…" : pollingLive ? "✓" : "✕"} · precinct turnout{" "}
            {precinctsLive === null ? "…" : precinctsLive ? "✓" : "✕"} (St. Louis County GIS).
          </p>
          <p className="mt-1">
            <strong>Coverage = St. Louis County portion of MO-02</strong> (polling clipped to the district).
            MO-02 also spans other counties not in this feed — see{" "}
            <span className="font-mono">candidate/data-and-map-plan.md</span>. Schools, public places, and
            partners are still sample.
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="h-[68vh] min-h-[420px] overflow-hidden rounded-lg border border-line shadow-card">
        <RegionMap3D
          visible={visible}
          buildings={buildings}
          turnout={turnout}
          pois={pois}
          precincts={precincts}
          jefferson={jefferson}
          showJefferson={showJefferson}
          extraCounties={extra}
          showExtra={showExtra}
          events={events}
          showEvents={showEvents}
        />
      </div>
    </div>
  );
}
