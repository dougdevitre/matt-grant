"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CATEGORIES, POIS, type Category } from "@/lib/mapData";

// MapLibre touches window/WebGL — load client-only.
const RegionMap3D = dynamic(() => import("@/components/RegionMap3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink/5 text-sm text-slate">Loading 3D map…</div>
  ),
});

const ALL: Category[] = ["schools", "public", "partners", "polling"];

export function MapExplorer() {
  const [visible, setVisible] = useState<Category[]>(ALL);
  const [buildings, setBuildings] = useState(true);
  const [turnout, setTurnout] = useState(true);

  const toggle = (c: Category) =>
    setVisible((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]));

  const count = (c: Category) => POIS.filter((p) => p.category === c).length;

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
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">3D blend</p>
          <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">Turnout columns</span>
            <input type="checkbox" checked={turnout} onChange={() => setTurnout((v) => !v)} />
          </label>
          <p className="mt-1 text-xs text-slate">Height = precinct turnout; color = GOP-primary intensity (illustrative).</p>
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">3D buildings</span>
            <input type="checkbox" checked={buildings} onChange={() => setBuildings((v) => !v)} />
          </label>
          <p className="mt-3 border-t border-line pt-3 text-xs text-slate">
            Drag to pan · right-drag to tilt/rotate · scroll to zoom.
          </p>
        </div>

        <div className="card border-gold/40 bg-gold/5 p-5 text-xs text-slate">
          <p className="font-semibold text-ink">Sample data.</p>
          <p className="mt-1">
            Points and turnout are illustrative. Swap in official layers (St. Louis County GIS, MSDIS, Census, OSM) —
            see <span className="font-mono">candidate/data-and-map-plan.md</span>.
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="h-[68vh] min-h-[420px] overflow-hidden rounded-lg border border-line shadow-card">
        <RegionMap3D visible={visible} buildings={buildings} turnout={turnout} />
      </div>
    </div>
  );
}
