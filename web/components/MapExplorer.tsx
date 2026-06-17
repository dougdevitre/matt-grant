"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, POIS, PRECINCTS, type Category } from "@/lib/mapData";

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

export function MapExplorer() {
  const [visible, setVisible] = useState<Category[]>(ALL);
  const [buildings, setBuildings] = useState(true);
  const [turnout, setTurnout] = useState(true);
  const [pois, setPois] = useState<GeoJSON.FeatureCollection>(sampleFC);
  const [pollingLive, setPollingLive] = useState<boolean | null>(null);
  const [precincts, setPrecincts] = useState<GeoJSON.FeatureCollection>(PRECINCTS);
  const [precinctsLive, setPrecinctsLive] = useState<boolean | null>(null);

  // Pull live layers (real St. Louis County polling places + precinct turnout) on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/geo/pois")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((fc) => {
        if (cancelled) return;
        setPois({ type: "FeatureCollection", features: fc.features });
        setPollingLive(!!fc.meta?.pollingLive);
      })
      .catch(() => !cancelled && setPollingLive(false));

    fetch("/api/geo/precincts")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((fc) => {
        if (cancelled) return;
        setPrecincts({ type: "FeatureCollection", features: fc.features });
        setPrecinctsLive(!!fc.meta?.live);
      })
      .catch(() => !cancelled && setPrecinctsLive(false));

    return () => {
      cancelled = true;
    };
  }, []);

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
              ? "Real MO-02 precinct turnout (Nov 2024 general). Height + heat = turnout %."
              : "Height + heat = precinct turnout (loading live data…)."}
          </p>
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">3D buildings</span>
            <input type="checkbox" checked={buildings} onChange={() => setBuildings((v) => !v)} />
          </label>
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
            Schools, public places, and partners are still sample. Add MSDIS schools + OSM public places —
            see <span className="font-mono">candidate/data-and-map-plan.md</span>.
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="h-[68vh] min-h-[420px] overflow-hidden rounded-lg border border-line shadow-card">
        <RegionMap3D visible={visible} buildings={buildings} turnout={turnout} pois={pois} precincts={precincts} />
      </div>
    </div>
  );
}
