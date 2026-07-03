"use client";

import { DataTable } from "@/components/dashboard/DataTable";
import { CHILDACT_TABLE, TIER_ORDER, tierGroup } from "@/lib/table/childact-config";
import type { RankedBill, ChildActView } from "@/lib/analysis/childActView";
import type { ColumnDef } from "@/lib/table/types";

// Read view for the CHILD Act bills source (Resource<ChildActView>). Renders on the
// shared <DataTable>, grouped by relevance tier, with the source note + tier counts
// above. Every row links to its congress.gov citation — the synthesis invents nothing.

const billLabel = (b: RankedBill) => `${b.billType.toUpperCase()} ${b.number}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const COLUMNS: ColumnDef<RankedBill>[] = [
  {
    key: "bill",
    header: "Bill",
    cell: (b) => (
      <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-xs font-semibold text-field hover:underline">
        {billLabel(b)} · {b.congress}th ↗
      </a>
    ),
    csv: (b) => `${billLabel(b)} (${b.congress}th)`,
  },
  {
    key: "title",
    header: "Title",
    sortable: true,
    cell: (b) => <span className="text-ink">{b.title ?? "—"}</span>,
    csv: (b) => b.title ?? "",
  },
  { key: "policy", header: "Policy area", cell: (b) => <span className="text-slate">{b.policyArea ?? "—"}</span>, csv: (b) => b.policyArea ?? "" },
  {
    key: "introduced",
    header: "Introduced",
    align: "right",
    sortable: true,
    cellClassName: "font-mono text-xs text-slate whitespace-nowrap",
    cell: (b) => when(b.introducedDate),
    csv: (b) => b.introducedDate ?? "",
  },
  {
    key: "score",
    header: "Score",
    align: "right",
    sortable: true,
    cellClassName: "font-mono tabular-nums",
    cell: (b) => b.relevance.score,
    csv: (b) => String(b.relevance.score),
  },
  {
    key: "subjects",
    header: "In the record of",
    cell: (b) => (
      <div className="flex flex-wrap gap-1">
        {b.subjects.map((s) => (
          <span key={`${s.slug}-${s.relation}`} className="rounded-sm bg-field/10 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field" title={s.relation}>
            {s.name}
          </span>
        ))}
      </div>
    ),
    csv: (b) => b.subjects.map((s) => `${s.name} (${s.relation})`).join("; "),
  },
];

export function ChildActTable({ data }: { data: ChildActView }) {
  return (
    <>
      <p className="mb-3 max-w-prose text-xs text-slate">{data.note}</p>
      <p className="mb-4 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">
        {data.byTier.core} core · {data.byTier.related} related · {data.byTier.tangential} tangential
      </p>
      <DataTable
        columns={COLUMNS}
        config={CHILDACT_TABLE}
        rows={data.bills}
        ctx={{}}
        rowKey={(b) => b.key}
        emptyLabel="No bills match these filters."
        summary={(f) => `${f.length} bill${f.length === 1 ? "" : "s"}`}
        minWidthClass="min-w-[56rem]"
        groupBy={tierGroup}
        groupOrder={TIER_ORDER}
        csvFilename="child-act-bills.csv"
      />
    </>
  );
}
