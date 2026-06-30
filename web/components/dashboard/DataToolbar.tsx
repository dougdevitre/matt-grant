"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { emptyState, activeFilterCount } from "@/lib/table/query";
import type { TableConfig, QueryState, TableCtx, FacetDef, FacetOption } from "@/lib/table/types";

// Reusable advanced search / filter / sort toolbar for dashboard lists. Native,
// accessible controls (input[type=search], select, details/checkbox, buttons) so it
// stays axe-clean. Drives state through the URL-bound setState from useTableQuery.
const inp = "rounded-sm border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-field";
const btn = "rounded-sm border border-line px-2.5 py-1.5 text-sm text-slate hover:border-ink hover:text-ink";
const chip = "inline-flex items-center gap-1 rounded-sm bg-field/10 px-2 py-0.5 font-mono text-[0.65rem] text-field";

function useDebouncedSearch(state: QueryState, setState: (s: QueryState) => void) {
  const [text, setText] = useState(state.q);
  const ref = useRef(state);
  ref.current = state;
  useEffect(() => setText(state.q), [state.q]); // external changes (preset / clear) win
  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== ref.current.q) setState({ ...ref.current, q: text });
    }, 220);
    return () => clearTimeout(id);
  }, [text, setState]);
  return [text, setText] as const;
}

export function DataToolbar<Row>({
  cfg, rows, state, setState, ctx = {}, shown,
}: {
  cfg: TableConfig<Row>;
  rows: Row[];
  state: QueryState;
  setState: (s: QueryState) => void;
  ctx?: TableCtx;
  shown: number;
}) {
  const [text, setText] = useDebouncedSearch(state, setState);
  const searchRef = useRef<HTMLInputElement>(null);
  const facets = useMemo(() => cfg.facets.filter((f) => !f.show || f.show(ctx)), [cfg, ctx]);

  // Per-option counts across all rows (a quick "how many" hint next to each value).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of facets) {
      if (f.type === "boolean") { m.set(f.key, rows.filter((r) => f.match(r, true, ctx)).length); continue; }
      for (const o of f.options?.(rows, ctx) ?? []) m.set(`${f.key}:${o.value}`, rows.filter((r) => f.match(r, [o.value], ctx)).length);
    }
    return m;
  }, [facets, rows, ctx]);

  // "/" focuses search; Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = (patch: Partial<QueryState>) => setState({ ...state, ...patch });
  const setFacet = (key: string, val: string[] | boolean) => set({ facets: { ...state.facets, [key]: val } });
  const clearFacet = (key: string) => { const f = { ...state.facets }; delete f[key]; set({ facets: f }); };
  const optsOf = (f: FacetDef<Row>): FacetOption[] => f.options?.(rows, ctx) ?? [];
  const labelOf = (f: FacetDef<Row>, value: string) => optsOf(f).find((o) => o.value === value)?.label ?? value;

  const nActive = activeFilterCount(cfg, state);

  return (
    <div className="mb-5 space-y-3">
      {/* Row 1: search · sort · count · views */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={searchRef}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search…  ( / )"
          aria-label="Search"
          className={`${inp} min-w-[14rem] flex-1`}
        />
        <label className="flex items-center gap-1 text-xs text-slate">
          <span className="font-mono uppercase tracking-eyebrow">Sort</span>
          <select aria-label="Sort by" value={state.sort} onChange={(e) => set({ sort: e.target.value })} className={inp}>
            {cfg.sorts.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => set({ dir: state.dir === "asc" ? "desc" : "asc" })}
          className={btn}
          aria-label={`Sort direction: ${state.dir === "asc" ? "ascending" : "descending"}`}
          title={state.dir === "asc" ? "Ascending" : "Descending"}
        >
          {state.dir === "asc" ? "↑" : "↓"}
        </button>
        <SavedViews cfg={cfg} state={state} setState={setState} />
        <span className="ml-auto font-mono text-xs text-slate">{shown} of {rows.length}</span>
      </div>

      {/* Row 2: facets */}
      <div className="flex flex-wrap items-center gap-2">
        {facets.map((f) => {
          if (f.type === "boolean") {
            const on = state.facets[f.key] === true;
            return (
              <label key={f.key} className={`flex cursor-pointer items-center gap-1.5 ${inp} ${on ? "border-field" : ""}`}>
                <input type="checkbox" checked={on} onChange={(e) => setFacet(f.key, e.target.checked)} className="h-3.5 w-3.5 accent-field" />
                <span className="text-xs">{f.label}</span>
                <span className="font-mono text-[0.6rem] text-slate">{counts.get(f.key) ?? 0}</span>
              </label>
            );
          }
          if (f.type === "select") {
            const sel = (state.facets[f.key] as string[] | undefined)?.[0] ?? "";
            return (
              <label key={f.key} className="flex items-center gap-1 text-xs text-slate">
                <span>{f.label}</span>
                <select aria-label={f.label} value={sel} onChange={(e) => (e.target.value ? setFacet(f.key, [e.target.value]) : clearFacet(f.key))} className={inp}>
                  <option value="">All</option>
                  {optsOf(f).map((o) => <option key={o.value} value={o.value}>{o.label} ({counts.get(`${f.key}:${o.value}`) ?? 0})</option>)}
                </select>
              </label>
            );
          }
          // multi → details + checkboxes
          const sel = (state.facets[f.key] as string[] | undefined) ?? [];
          return (
            <details key={f.key} className="relative">
              <summary className={`${inp} cursor-pointer list-none ${sel.length ? "border-field text-field" : "text-slate"}`}>
                {f.label}{sel.length ? ` (${sel.length})` : ""}
              </summary>
              <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-sm border border-line bg-white p-2 shadow-card">
                {optsOf(f).map((o) => {
                  const checked = sel.includes(o.value);
                  return (
                    <label key={o.value} className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-sm text-ink hover:bg-line/30">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setFacet(f.key, checked ? sel.filter((v) => v !== o.value) : [...sel, o.value])}
                        className="h-3.5 w-3.5 accent-field"
                      />
                      <span className="flex-1">{o.label}</span>
                      <span className="font-mono text-[0.6rem] text-slate">{counts.get(`${f.key}:${o.value}`) ?? 0}</span>
                    </label>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      {/* Row 3: active chips + clear-all */}
      {nActive > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {state.q.trim() && (
            <button type="button" className={chip} onClick={() => set({ q: "" })} aria-label="Clear search">
              “{state.q.trim()}” ✕
            </button>
          )}
          {facets.map((f) => {
            const sel = state.facets[f.key];
            if (sel === true) {
              return <button key={f.key} type="button" className={chip} onClick={() => clearFacet(f.key)} aria-label={`Remove ${f.label}`}>{f.label} ✕</button>;
            }
            if (Array.isArray(sel)) {
              return sel.map((v) => (
                <button key={`${f.key}:${v}`} type="button" className={chip} onClick={() => setFacet(f.key, sel.filter((x) => x !== v))} aria-label={`Remove ${f.label} ${labelOf(f, v)}`}>
                  {f.label}: {labelOf(f, v)} ✕
                </button>
              ));
            }
            return null;
          })}
          <button type="button" className="font-mono text-[0.65rem] text-brick hover:underline" onClick={() => setState(emptyState(cfg))}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

// ── Saved views: code presets + per-browser user views (localStorage) ─────────────
function SavedViews<Row>({ cfg, state, setState }: { cfg: TableConfig<Row>; state: QueryState; setState: (s: QueryState) => void }) {
  const storeKey = `tableviews:${cfg.id}`;
  const [userViews, setUserViews] = useState<{ name: string; state: QueryState }[]>([]);
  useEffect(() => {
    try { setUserViews(JSON.parse(localStorage.getItem(storeKey) || "[]")); } catch { setUserViews([]); }
  }, [storeKey]);

  const persist = (next: { name: string; state: QueryState }[]) => {
    setUserViews(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const apply = (partial: Partial<QueryState>) => setState({ ...emptyState(cfg), ...partial });
  const saveCurrent = () => {
    const name = window.prompt("Name this view")?.trim();
    if (name) persist([...userViews.filter((v) => v.name !== name), { name, state }]);
  };

  return (
    <details className="relative">
      <summary className={`${btn} cursor-pointer list-none`}>Views</summary>
      <div className="absolute z-10 mt-1 w-60 rounded-sm border border-line bg-white p-2 text-sm shadow-card">
        {(cfg.presets ?? []).length > 0 && <p className="px-1 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Presets</p>}
        {(cfg.presets ?? []).map((p) => (
          <button key={p.name} type="button" className="block w-full rounded-sm px-2 py-1 text-left text-ink hover:bg-line/30" onClick={() => apply(p.state)}>
            {p.name}
          </button>
        ))}
        {userViews.length > 0 && <p className="mt-1 px-1 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Saved</p>}
        {userViews.map((v) => (
          <div key={v.name} className="flex items-center gap-1">
            <button type="button" className="flex-1 rounded-sm px-2 py-1 text-left text-ink hover:bg-line/30" onClick={() => setState({ ...emptyState(cfg), ...v.state })}>
              {v.name}
            </button>
            <button type="button" className="px-1.5 text-brick hover:underline" aria-label={`Delete view ${v.name}`} onClick={() => persist(userViews.filter((x) => x.name !== v.name))}>✕</button>
          </div>
        ))}
        <button type="button" className="mt-1 block w-full rounded-sm border border-line px-2 py-1 text-center text-slate hover:border-ink hover:text-ink" onClick={saveCurrent}>
          Save current view…
        </button>
      </div>
    </details>
  );
}
