// Pure, React-free helpers for the <DataTable> render layer (query.ts owns the
// filter/sort math; this owns the presentation-side transforms). Split out so the
// click-to-sort logic, group partitioning, and CSV serialization are unit-testable
// without mounting a component — mirrors how Meter kept meterAria in a pure .ts.
import type { ColumnDef, QueryState, TableCtx } from "./types";

/**
 * Column-header click → next sort state. Clicking the active column flips its
 * direction; clicking a new column selects it ascending. Returns only the sort
 * fields so the caller can spread them onto the existing QueryState (keeping q +
 * facets untouched), which then flows through the same URL binding as the toolbar
 * sort <select>.
 */
export function nextSort(state: QueryState, key: string): Pick<QueryState, "sort" | "dir"> {
  if (state.sort === key) return { sort: key, dir: state.dir === "asc" ? "desc" : "asc" };
  return { sort: key, dir: "asc" };
}

/**
 * Partition already-filtered/sorted rows into labeled sections for grouped tables
 * (e.g. the print tracker by category). Groups appear in `order`; any group not in
 * `order` is appended in first-seen order. Empty groups are omitted, and row order
 * within each group is preserved (so an upstream sort still holds).
 */
export function groupRows<Row>(
  rows: Row[],
  by: (row: Row) => string,
  order: readonly string[] = [],
): [string, Row[]][] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = by(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  const seen = new Set<string>();
  const out: [string, Row[]][] = [];
  for (const k of order) {
    const bucket = map.get(k);
    if (bucket) { out.push([k, bucket]); seen.add(k); }
  }
  for (const [k, bucket] of map) {
    if (!seen.has(k)) out.push([k, bucket]);
  }
  return out;
}

// A field that a spreadsheet would evaluate as a formula on open: it begins with
// = @ TAB or CR, or with +/- while NOT being a plain number. RFC-4180 quoting does
// NOT defuse these — Excel/Sheets still run `"=HYPERLINK(...)"` — so they must be
// neutralized separately (prefix a `'`). Real negatives / "-5.9%" stay untouched.
const NUMERIC = /^[+-]?(\d[\d,]*)(\.\d+)?%?$/;
function neutralizeFormula(value: string): string {
  if (value === "") return value;
  const c = value[0];
  const dangerous = c === "=" || c === "@" || c === "\t" || c === "\r" || ((c === "+" || c === "-") && !NUMERIC.test(value));
  return dangerous ? `'${value}` : value;
}

/** Serialize a single CSV field: neutralize spreadsheet formula injection, then
 *  quote+escape per RFC-4180 (only when it must be quoted). */
export function csvField(value: string): string {
  const v = neutralizeFormula(value);
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** A plain header + value accessor for CSV export decoupled from the visible
 *  columns — lets a list export more (or differently-shaped) fields than it shows
 *  (e.g. the influencer worklist exports its pipeline fields that share cells). */
export type ExportColumn<Row, Ctx extends TableCtx = TableCtx> = {
  header: string;
  value: (row: Row, ctx: Ctx) => string;
};

/** Serialize rows to CSV from an explicit ExportColumn list. */
export function exportCsv<Row, Ctx extends TableCtx>(
  cols: ExportColumn<Row, Ctx>[],
  rows: Row[],
  ctx: Ctx,
): string {
  if (cols.length === 0) return "";
  const lines = [cols.map((c) => csvField(c.header)).join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => csvField(c.value(r, ctx))).join(","));
  }
  return lines.join("\r\n");
}

/**
 * Serialize rows to CSV using each column's `csv` accessor (columns without one are
 * skipped, so a header-only or action column is naturally excluded). The header row
 * uses each exporting column's `header`.
 */
export function toCsv<Row, Ctx extends TableCtx>(
  columns: ColumnDef<Row, Ctx>[],
  rows: Row[],
  ctx: Ctx,
): string {
  const cols: ExportColumn<Row, Ctx>[] = columns
    .filter((c) => c.csv)
    .map((c) => ({ header: c.header, value: c.csv! }));
  return exportCsv(cols, rows, ctx);
}
