// Reusable client-side table query model — powers advanced search + faceted filter
// + sort across dashboard lists (Volunteers, Donors, Tasks). A list supplies a
// declarative TableConfig; the pure engine in query.ts applies it, and DataToolbar
// renders the controls. No server calls — all client-side over already-loaded rows.

export type SortDir = "asc" | "desc";
export type FacetType = "select" | "multi" | "boolean";

export type FacetOption = { value: string; label: string };

/** Runtime context a facet/sort may need beyond the row (e.g. the signed-in user,
 *  derived sets like donor emails). Caller must memoize it (it's a memo dep). */
export type TableCtx = Record<string, unknown>;

export type FacetDef<Row> = {
  key: string; // URL param (f.<key>) + identity; keep stable
  label: string;
  type: FacetType;
  /** Options for select/multi facets (often derived from the rows). */
  options?: (rows: Row[], ctx: TableCtx) => FacetOption[];
  /** True if the row passes this facet for the given selection. */
  match: (row: Row, selected: string[] | boolean, ctx: TableCtx) => boolean;
  /** Hide the facet entirely when this returns false (e.g. capability-gated). */
  show?: (ctx: TableCtx) => boolean;
};

export type SortDef<Row> = {
  key: string;
  label: string;
  /** Ascending comparator; the engine reverses for "desc". */
  compare: (a: Row, b: Row, ctx: TableCtx) => number;
};

export type QueryState = {
  q: string;
  facets: Record<string, string[] | boolean>;
  sort: string;
  dir: SortDir;
};

export type Preset = { name: string; state: Partial<QueryState> };

export type TableConfig<Row> = {
  id: string; // URL/localStorage namespace
  /** Concatenated searchable text for a row (lowercased + tokenized by the engine). */
  search: (row: Row) => string;
  facets: FacetDef<Row>[];
  sorts: SortDef<Row>[];
  defaultSort: { key: string; dir: SortDir };
  presets?: Preset[];
};
