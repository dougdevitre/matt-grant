"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, EVENT_COLOR, POIS, PRECINCTS, type Category } from "@/lib/mapData";
import { SIGN_COLOR } from "@/lib/viz/palette";
import { useResource } from "@/lib/data/useResource";
import { legendFor, modeStats, type MapMode, type ModeLegend } from "@/lib/viz/precinctPaint";
// (turnout gradient now comes through legendFor — no direct palette import needed)
import { bboxOfFeatureCollections } from "@/lib/viz/mapView";
import { buildSearchIndex, searchEntries, type SearchEntry } from "@/lib/viz/mapSearch";
import type { MapFocus } from "@/components/RegionMap3D";

// MapLibre touches window/WebGL — load client-only.
const RegionMap3D = dynamic(() => import("@/components/RegionMap3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink/5 text-sm text-slate">Loading 3D map…</div>
  ),
});

const ALL: Category[] = ["schools", "public", "partners", "polling"];

const MODES: { key: MapMode; label: string }[] = [
  { key: "turnout", label: "Turnout" },
  { key: "tier", label: "Target tier" },
  { key: "gotv", label: "GOTV upside" },
  { key: "voter", label: "Voter file" },
  { key: "earlyVote", label: "Early vote" },
];

// Shared legend block — rendered in both the side panel and the on-map overlay,
// always from the same legendFor() spec as the paint expressions.
function LegendBlock({ legend }: { legend: ModeLegend }) {
  if (legend.kind === "swatches") {
    return (
      <div>
        {legend.entries.map((e) => (
          <p key={e.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-white" style={{ background: e.color }} aria-hidden />
            <span className="text-[0.65rem]">{e.label}</span>
          </p>
        ))}
        <p className="mt-1 text-[0.6rem] text-slate">{legend.note}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="h-2 w-full rounded-full" style={{ background: legend.gradient }} aria-hidden />
      <div className="mt-0.5 flex justify-between font-mono text-[0.55rem]">
        <span>{legend.minLabel}</span>
        <span>{legend.maxLabel}</span>
      </div>
      <p className="mt-1 text-[0.6rem] text-slate">{legend.note}</p>
    </div>
  );
}

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
type GeoMeta = { live?: boolean; count?: number; pollingLive?: boolean; live_layers?: string[] };

export function MapExplorer({ initialPrecinct }: { initialPrecinct?: string } = {}) {
  const [visible, setVisible] = useState<Category[]>(ALL);
  const [buildings, setBuildings] = useState(true);
  const [turnout, setTurnout] = useState(true);
  const [mode, setMode] = useState<MapMode>("turnout");
  const [showJefferson, setShowJefferson] = useState(true);
  const [showExtra, setShowExtra] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  // Signs default OFF — a new ~200-pin layer shouldn't ambush the existing map.
  const [showSigns, setShowSigns] = useState(false);
  // Small screens get the map first with the control column behind a toggle;
  // ≥lg both always show (the max-lg classes below are inert there).
  const [showControls, setShowControls] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const focusToken = useRef(0);
  const didDeepLink = useRef(false);
  // Search / jump-to combobox state.
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // The live layers, each on the shared Resource hook (loading/ready/empty/
  // degraded/error). The {type,features,meta} payload normalizes to data+meta.
  const poisRes = useResource<GeoJSON.FeatureCollection>("/api/geo/pois");
  const precinctsRes = useResource<GeoJSON.FeatureCollection>("/api/geo/precincts");
  const jeffersonRes = useResource<GeoJSON.FeatureCollection>("/api/geo/jefferson");
  const extraRes = useResource<GeoJSON.FeatureCollection>("/api/geo/extra-counties");
  const eventsRes = useResource<GeoJSON.FeatureCollection>("/api/geo/events");
  const signsRes = useResource<GeoJSON.FeatureCollection>("/api/geo/signs");

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
  const signs = useMemo(() => featuresOf(signsRes, emptyFC), [signsRes]);

  // Indicators: null while loading, then the live flag / count from meta.
  // Per-category POI live/sample badges come from the route's live_layers list,
  // so a newly-lived-up category (e.g. schools) badges truthfully with no UI edit.
  const liveLayers = poisRes.state === "loading" ? null : ((poisRes.meta as GeoMeta | null)?.live_layers ?? []);
  const categoryLive = (c: Category) => Boolean(liveLayers?.includes(c));
  const pollingLive = poisRes.state === "loading" ? null : Boolean((poisRes.meta as GeoMeta | null)?.pollingLive);
  const precinctsLive = precinctsRes.state === "loading" ? null : Boolean((precinctsRes.meta as GeoMeta | null)?.live);
  const jeffCount = jeffersonRes.state === "loading" ? null : ((jeffersonRes.meta as GeoMeta | null)?.count ?? 0);
  const extraCount = extraRes.state === "loading" ? null : ((extraRes.meta as GeoMeta | null)?.count ?? 0);
  const eventCount = eventsRes.state === "loading" ? null : ((eventsRes.meta as GeoMeta | null)?.count ?? 0);
  const signCount = signsRes.state === "loading" ? null : ((signsRes.meta as GeoMeta | null)?.count ?? 0);

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

  // Tier/GOTV need the scored LIVE feed — sample precincts carry no tier/expected.
  const modesAvailable = Boolean(precinctsLive);
  // Voter mode additionally needs the voter-file join: the precincts route only
  // stamps vPropensity/persuade when VOTERAGG rollups exist (post-ingest).
  const voterAvailable = useMemo(
    () =>
      precincts.features.some(
        (f) => typeof (f.properties as { vPropensity?: unknown } | null)?.vPropensity === "number",
      ),
    [precincts],
  );
  // Early-vote mode needs actual banked returns on at least one feature.
  const earlyVoteAvailable = useMemo(
    () =>
      precincts.features.some(
        (f) => Number((f.properties as { banked?: unknown } | null)?.banked) > 0,
      ),
    [precincts],
  );
  const modeAvailable = (m: MapMode) =>
    m === "turnout" ||
    (m === "voter" ? voterAvailable : m === "earlyVote" ? earlyVoteAvailable : modesAvailable);
  const activeMode: MapMode = modeAvailable(mode) ? mode : "turnout";
  const legend = useMemo(() => legendFor(activeMode, modeStats(precincts.features)), [activeMode, precincts]);

  // ?precinct= deep link (from the Targets table): once live precincts arrive,
  // resolve the name to its feature and issue a one-shot focus command.
  useEffect(() => {
    if (!initialPrecinct || didDeepLink.current || !precinctsLive) return;
    const feat = precincts.features.find(
      (f) => (f.properties as { name?: string } | null)?.name === initialPrecinct,
    );
    if (!feat) return;
    const bounds = bboxOfFeatureCollections([{ type: "FeatureCollection", features: [feat] }]);
    if (!bounds) return;
    didDeepLink.current = true;
    setFocus({ bounds, featureId: initialPrecinct, token: ++focusToken.current });
  }, [initialPrecinct, precinctsLive, precincts]);

  // Search index over everything currently plotted; rebuilt only when a layer's
  // data actually changes. Selection reuses the same focus command as deep links.
  const searchIndex = useMemo(
    () => buildSearchIndex({ precincts, pois, events, jefferson, extra, signs }),
    [precincts, pois, events, jefferson, extra, signs],
  );
  const results = useMemo(() => searchEntries(searchIndex, query), [searchIndex, query]);
  const jumpTo = (e: SearchEntry) => {
    setFocus({ bounds: e.bounds, featureId: e.featureId, token: ++focusToken.current });
    setQuery("");
    setActiveIdx(0);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Controls */}
      <div className={`space-y-4 max-lg:order-2 ${showControls ? "" : "max-lg:hidden"}`}>
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
                    {categoryLive(c) ? (
                      <span className="ml-2 rounded-sm bg-field/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field">
                        live
                      </span>
                    ) : (
                      liveLayers !== null && (
                        <span className="ml-2 rounded-sm bg-line px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-slate">
                          sample
                        </span>
                      )
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
              Precinct columns
              {precinctsLive && (
                <span className="ml-2 rounded-sm bg-field/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field">live</span>
              )}
            </span>
            <input type="checkbox" checked={turnout} onChange={() => setTurnout((v) => !v)} />
          </label>
          {turnout && (
            <>
              <div className="mt-2 flex rounded-sm border border-line p-0.5" role="group" aria-label="Color and height mode">
                {MODES.map((m) => {
                  const disabled = !modeAvailable(m.key);
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMode(m.key)}
                      disabled={disabled}
                      aria-pressed={activeMode === m.key}
                      className={`flex-1 rounded-sm px-1.5 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow transition-colors ${
                        activeMode === m.key ? "bg-field text-white" : disabled ? "text-line" : "text-slate hover:bg-paper"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              {!modesAvailable && (
                <p className="mt-1 text-[0.6rem] text-slate">Tier / GOTV modes need the live scored feed (loading…).</p>
              )}
              {modesAvailable && !voterAvailable && (
                <p className="mt-1 text-[0.6rem] text-slate">
                  Voter mode lights up after the voter-file ingest (Field → Voter database).
                </p>
              )}
              {modesAvailable && voterAvailable && !earlyVoteAvailable && (
                <p className="mt-1 text-[0.6rem] text-slate">
                  Early-vote mode lights up once returns import (Field → Ballot chase).
                </p>
              )}
              <div className="mt-3">
                <LegendBlock legend={legend} />
                <p className="mt-1 text-[0.6rem] text-slate">Click a column for its numbers.</p>
              </div>
            </>
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
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SIGN_COLOR.verified }} aria-hidden />
              Signs
              {signCount ? <span className="ml-2 font-mono text-xs text-slate">{signCount}</span> : null}
            </span>
            <input type="checkbox" checked={showSigns} onChange={() => setShowSigns((v) => !v)} />
          </label>
          <p className="mt-1 text-xs text-slate">
            Saved sign placements with coordinates (Field → Signs). Blue = verified (all three
            compliance gates), amber = pending verification. Off by default.
          </p>
          <p className="mt-3 border-t border-line pt-3 text-xs text-slate">
            Drag to pan · right-drag to tilt/rotate · scroll to zoom.
          </p>
        </div>

        <div className="card border-gold/40 bg-gold/5 p-5 text-xs text-slate">
          <p className="font-semibold text-ink">
            Live: polling {pollingLive === null ? "…" : pollingLive ? "✓" : "✕"} · precinct turnout{" "}
            {precinctsLive === null ? "…" : precinctsLive ? "✓" : "✕"} · schools{" "}
            {liveLayers === null ? "…" : categoryLive("schools") ? "✓" : "✕"}.
          </p>
          <p className="mt-1">
            <strong>Polling &amp; turnout cover the St. Louis County portion of MO-02</strong> (clipped to
            the district); live schools (DESE), when ✓, cover the full district. MO-02 also spans
            counties with no precinct feed — see{" "}
            <span className="font-mono">candidate/data-and-map-plan.md</span>. Public places and
            partners are still sample{liveLayers !== null && !categoryLive("schools") ? "; schools are sample until the DESE feed connects" : ""}.
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="max-lg:order-1">
        <div className="mb-2 flex items-start gap-2">
          {/* Jump-to search — pure client-side index over the plotted layers
              (precincts, municipalities, POIs, events, counties); no geocoder. */}
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={(e) => {
                if (!results.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  jumpTo(results[activeIdx] ?? results[0]);
                } else if (e.key === "Escape") {
                  setQuery("");
                }
              }}
              placeholder="Jump to a precinct, municipality, polling place, event…"
              aria-label="Search the map"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="map-search-results"
              className="w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-field"
            />
            {results.length > 0 && (
              <ul
                id="map-search-results"
                role="listbox"
                className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-card"
              >
                {results.map((r, i) => (
                  <li key={`${r.kind}-${r.label}`} role="option" aria-selected={i === activeIdx}>
                    <button
                      type="button"
                      onClick={() => jumpTo(r)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm ${i === activeIdx ? "bg-paper" : ""}`}
                    >
                      <span className="font-semibold text-ink">{r.label}</span>
                      {r.sublabel && <span className="truncate text-xs text-slate">{r.sublabel}</span>}
                      <span className="ml-auto shrink-0 font-mono text-[0.55rem] uppercase tracking-eyebrow text-slate">{r.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowControls((v) => !v)}
            className="btn-ghost lg:hidden"
            aria-expanded={showControls}
          >
            {showControls ? "Hide layer controls" : "Show layer controls"}
          </button>
        </div>
        <div className="relative h-[68vh] min-h-[420px] overflow-hidden rounded-lg border border-line shadow-card">
          <RegionMap3D
            visible={visible}
            buildings={buildings}
            turnout={turnout}
            mode={activeMode}
            pois={pois}
            precincts={precincts}
            precinctsLive={Boolean(precinctsLive)}
            jefferson={jefferson}
            showJefferson={showJefferson}
            extraCounties={extra}
            showExtra={showExtra}
            events={events}
            showEvents={showEvents}
            signs={signs}
            showSigns={showSigns}
            focus={focus}
          />
          {/* On-map legend — collapsed by default; the side panel keeps the full
              annotated version. pointer-events split so the map stays draggable
              around the collapsed chip. */}
          <div className="pointer-events-none absolute bottom-6 right-3 z-10 max-w-[13rem]">
            <details className="pointer-events-auto rounded-md border border-line bg-white/95 shadow-card backdrop-blur-sm">
              <summary className="cursor-pointer select-none px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                Legend
              </summary>
              <div className="space-y-2 px-3 pb-3 text-xs text-slate">
                {turnout && <LegendBlock legend={legend} />}
                {visible.map((c) => (
                  <p key={c} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: CATEGORIES[c].color }} aria-hidden />
                    {CATEGORIES[c].label}
                  </p>
                ))}
                {showEvents && (
                  <p className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: EVENT_COLOR }} aria-hidden />
                    Events
                  </p>
                )}
                {showSigns && (
                  <>
                    <p className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: SIGN_COLOR.verified }} aria-hidden />
                      Signs — verified
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white" style={{ background: SIGN_COLOR.pending }} aria-hidden />
                      Signs — pending
                    </p>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
