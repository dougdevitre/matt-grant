"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DataToolbar } from "@/components/dashboard/DataToolbar";
import { useTableQuery } from "@/components/dashboard/useTableQuery";
import { nextSort, groupRows, toCsv, exportCsv, type ExportColumn } from "@/lib/table/view";
import type { ColumnDef, TableConfig, TableCtx, QueryState } from "@/lib/table/types";

// Shared render layer for dashboard lists: given the existing filter/sort engine
// (TableConfig + useTableQuery + DataToolbar) and a set of ColumnDefs, it draws the
// toolbar + a styled <table> with click-to-sort headers, optional grouping, an
// optional expandable detail row, and CSV export. The per-list config still owns
// search/facets/sort; a list supplies columns + rows. Visual style matches the
// hand-rolled tables it replaces (card shell, mono uppercase headers, divided rows).

const HEAD = "px-5 py-3 font-mono text-xs uppercase tracking-eyebrow";
const CELL = "px-5 py-3";
const btn = "rounded-sm border border-line px-2.5 py-1.5 text-sm text-slate hover:border-ink hover:text-ink";

type Props<Row, Ctx extends TableCtx> = {
  columns: ColumnDef<Row, Ctx>[];
  config: TableConfig<Row>;
  rows: Row[];
  ctx: Ctx;
  /** Stable React key + row identity (used for the detail-expansion set). */
  rowKey: (row: Row) => string;
  emptyLabel: string;
  /** Optional line under the toolbar (e.g. "Showing $X across N donors"). */
  summary?: (filtered: Row[]) => ReactNode;
  /** Tailwind min-width on the table for horizontal scroll (e.g. "min-w-[34rem]"). */
  minWidthClass?: string;
  /** Render sectioned tables (e.g. print tracker by category). */
  groupBy?: (row: Row) => string;
  groupOrder?: readonly string[];
  /** Expandable per-row detail (e.g. the influencer inline editor). `close`
   *  collapses the row (for a Cancel/Done button inside the detail). */
  renderDetail?: (row: Row, ctx: Ctx, close: () => void) => ReactNode;
  /** Filename for the Export CSV button (shown only when export is available). */
  csvFilename?: string;
  /** Export these fields instead of the visible columns' `csv` accessors — for lists
   *  whose CSV should carry more/differently-shaped fields than the table shows. */
  csvColumns?: ExportColumn<Row, Ctx>[];
  /** Suppress the built-in Export CSV button (e.g. a page with a server export). */
  hideExport?: boolean;
};

export function DataTable<Row, Ctx extends TableCtx>({
  columns, config, rows, ctx, rowKey, emptyLabel, summary,
  minWidthClass, groupBy, groupOrder, renderDetail, csvFilename, csvColumns, hideExport,
}: Props<Row, Ctx>) {
  const { state, setState, filtered } = useTableQuery(rows, config, ctx);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const canExport = useMemo(
    () => !hideExport && (csvColumns ? csvColumns.length > 0 : columns.some((c) => c.csv)),
    [hideExport, csvColumns, columns],
  );
  const colSpan = columns.length + (renderDetail ? 1 : 0);

  function download() {
    const csv = csvColumns ? exportCsv(csvColumns, filtered, ctx) : toCsv(columns, filtered, ctx);
    if (!csv) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename ?? `${config.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const groups = groupBy ? groupRows(filtered, groupBy, groupOrder) : ([["", filtered]] as [string, Row[]][]);

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-line p-3">
        <DataToolbar cfg={config} rows={rows} state={state} setState={setState} ctx={ctx} shown={filtered.length} />
        {(summary || canExport) && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="font-mono text-xs text-slate">{summary?.(filtered)}</div>
            {canExport && (
              <button type="button" onClick={download} className={btn} disabled={filtered.length === 0}>
                Export CSV
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="p-8 text-center text-slate">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${minWidthClass ?? ""}`}>
            <thead className="border-b border-line bg-paper text-left text-slate">
              <tr>
                {columns.map((c) => (
                  <SortHeader key={c.key} col={c} state={state} onSort={(k) => setState({ ...state, ...nextSort(state, k) })} />
                ))}
                {renderDetail && <th className={HEAD}><span className="sr-only">Details</span></th>}
              </tr>
            </thead>
            {groups.map(([group, groupRowsList]) => (
              <tbody key={group || "_all"} className="divide-y divide-line">
                {group && (
                  <tr className="bg-paper/60">
                    <th colSpan={colSpan} className="px-5 py-2 text-left font-mono text-[0.65rem] uppercase tracking-eyebrow text-field">
                      {group}
                    </th>
                  </tr>
                )}
                {groupRowsList.map((row) => {
                  const key = rowKey(row);
                  const isOpen = open.has(key);
                  return (
                    <FragmentRow
                      key={key}
                      rowKey={key}
                      row={row}
                      ctx={ctx}
                      columns={columns}
                      renderDetail={renderDetail}
                      isOpen={isOpen}
                      colSpan={colSpan}
                      onToggle={() =>
                        setOpen((prev) => {
                          const nextSet = new Set(prev);
                          if (nextSet.has(key)) nextSet.delete(key);
                          else nextSet.add(key);
                          return nextSet;
                        })
                      }
                    />
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}

function SortHeader<Row, Ctx extends TableCtx>({
  col, state, onSort,
}: {
  col: ColumnDef<Row, Ctx>;
  state: QueryState;
  onSort: (key: string) => void;
}) {
  const active = state.sort === col.key;
  const alignCls = col.align === "right" ? "text-right" : "text-left";
  const ariaSort = col.sortable ? (active ? (state.dir === "asc" ? "ascending" : "descending") : "none") : undefined;
  return (
    <th className={`${HEAD} ${alignCls} ${col.headerClassName ?? ""}`} aria-sort={ariaSort}>
      {col.sortable ? (
        <button
          type="button"
          onClick={() => onSort(col.key)}
          className={`inline-flex items-center gap-1 uppercase tracking-eyebrow hover:text-ink ${active ? "text-ink" : ""} ${col.align === "right" ? "flex-row-reverse" : ""}`}
        >
          {col.header}
          <span aria-hidden="true" className="text-[0.7em]">{active ? (state.dir === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
      ) : (
        col.header
      )}
    </th>
  );
}

function FragmentRow<Row, Ctx extends TableCtx>({
  row, rowKey, ctx, columns, renderDetail, isOpen, colSpan, onToggle,
}: {
  row: Row;
  rowKey: string;
  ctx: Ctx;
  columns: ColumnDef<Row, Ctx>[];
  renderDetail?: (row: Row, ctx: Ctx, close: () => void) => ReactNode;
  isOpen: boolean;
  colSpan: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-paper">
        {columns.map((c) => (
          <td key={c.key} className={`${CELL} ${c.align === "right" ? "text-right" : ""} ${c.cellClassName ?? ""}`}>
            {c.cell(row, ctx)}
          </td>
        ))}
        {renderDetail && (
          <td className={`${CELL} text-right`}>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-controls={isOpen ? `detail-${rowKey}` : undefined}
              className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate hover:border-ink hover:text-ink"
            >
              {isOpen ? "Close" : "Edit"}
            </button>
          </td>
        )}
      </tr>
      {renderDetail && isOpen && (
        <tr id={`detail-${rowKey}`}>
          <td colSpan={colSpan} className="bg-paper/50 px-5 py-4">
            {renderDetail(row, ctx, onToggle)}
          </td>
        </tr>
      )}
    </>
  );
}
