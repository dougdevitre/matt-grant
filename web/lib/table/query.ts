// Pure table-query engine — no React, no Next, no I/O — so it's fully unit-testable.
// Applies a TableConfig + QueryState to rows (search → facets → sort), and converts
// state ↔ URLSearchParams (only non-defaults, so links stay short and shareable).
import type { TableConfig, QueryState, TableCtx, SortDir } from "./types";

export function emptyState<Row>(cfg: TableConfig<Row>): QueryState {
  return { q: "", facets: {}, sort: cfg.defaultSort.key, dir: cfg.defaultSort.dir };
}

/** Split a query into terms, honoring "quoted phrases". Every term must match. */
export function tokenize(q: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push((m[1] ?? m[2]).toLowerCase());
  return out;
}

/** Filter + sort rows for the given state. Pure; `ctx` carries runtime values. */
export function applyQuery<Row>(
  rows: Row[],
  cfg: TableConfig<Row>,
  state: QueryState,
  ctx: TableCtx = {},
): Row[] {
  const tokens = tokenize(state.q);
  const activeFacets = cfg.facets.filter((f) => {
    if (f.show && !f.show(ctx)) return false;
    const sel = state.facets[f.key];
    if (sel === undefined) return false;
    if (Array.isArray(sel)) return sel.length > 0;
    return sel === true; // boolean facet only filters when ON
  });

  const filtered = rows.filter((r) => {
    if (tokens.length) {
      const hay = cfg.search(r).toLowerCase();
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    for (const f of activeFacets) {
      if (!f.match(r, state.facets[f.key], ctx)) return false;
    }
    return true;
  });

  const sort = cfg.sorts.find((s) => s.key === state.sort) ?? cfg.sorts[0];
  if (!sort) return filtered;
  const sorted = [...filtered].sort((a, b) => sort.compare(a, b, ctx));
  return state.dir === "desc" ? sorted.reverse() : sorted;
}

const FKEY = (k: string) => `f.${k}`;

/** State → URLSearchParams, omitting anything at its default (compact, shareable). */
export function stateToParams<Row>(cfg: TableConfig<Row>, state: QueryState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  for (const f of cfg.facets) {
    const sel = state.facets[f.key];
    if (Array.isArray(sel) && sel.length) p.set(FKEY(f.key), sel.join(","));
    else if (sel === true) p.set(FKEY(f.key), "1");
  }
  if (state.sort !== cfg.defaultSort.key) p.set("sort", state.sort);
  if (state.dir !== cfg.defaultSort.dir) p.set("dir", state.dir);
  return p;
}

type ParamsLike = { get(name: string): string | null };

/** URLSearchParams → validated QueryState (unknown keys/sorts fall back to defaults). */
export function paramsToState<Row>(cfg: TableConfig<Row>, params: ParamsLike): QueryState {
  const state = emptyState(cfg);
  state.q = params.get("q") ?? "";
  for (const f of cfg.facets) {
    const raw = params.get(FKEY(f.key));
    if (raw == null) continue;
    if (f.type === "boolean") state.facets[f.key] = raw === "1";
    else state.facets[f.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const sort = params.get("sort");
  if (sort && cfg.sorts.some((s) => s.key === sort)) state.sort = sort;
  const dir = params.get("dir");
  if (dir === "asc" || dir === "desc") state.dir = dir as SortDir;
  return state;
}

/** Count of active facet selections + a non-empty search — for the "N filters" badge. */
export function activeFilterCount<Row>(cfg: TableConfig<Row>, state: QueryState): number {
  let n = state.q.trim() ? 1 : 0;
  for (const f of cfg.facets) {
    const sel = state.facets[f.key];
    if (Array.isArray(sel)) n += sel.length ? 1 : 0;
    else if (sel === true) n += 1;
  }
  return n;
}
