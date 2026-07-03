"use client";

import { DataTable } from "@/components/dashboard/DataTable";
import { PRINT_TABLE, PRINT_CATEGORY_ORDER } from "@/lib/table/print-config";
import type { PrintItem } from "@/lib/data/printTracker";
import type { ColumnDef } from "@/lib/table/types";

function Flag({ label }: { label: string }) {
  return (
    <span className="mr-1 inline-block rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ready = status === "Draft ready" || status === "In hand";
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${ready ? "bg-field/10 text-field" : "bg-ink/5 text-slate"}`}>
      {status || "—"}
    </span>
  );
}

const flagText = (r: PrintItem) =>
  [
    r.disclaimer_required === "Y" ? "Disclaimer" : "",
    r.solicitation_tax_line === "Y" ? "Tax line" : "",
    r.internal_only === "Y" ? "Internal" : "",
  ].filter(Boolean).join(" / ");

const COLUMNS: ColumnDef<PrintItem>[] = [
  { key: "item", header: "Item", sortable: true, cell: (r) => <span className="font-medium text-ink">{r.item}</span>, csv: (r) => r.item },
  { key: "template", header: "Template", cell: (r) => <code className="font-mono text-xs text-slate">{r.template}</code>, csv: (r) => r.template },
  { key: "sheet", header: "Sheet", sortable: true, cell: (r) => <span className="whitespace-nowrap text-slate">{r.sheet_size}</span>, csv: (r) => r.sheet_size },
  {
    key: "flags",
    header: "Flags",
    cell: (r) => (
      <>
        {r.disclaimer_required === "Y" && <Flag label="Disclaimer" />}
        {r.solicitation_tax_line === "Y" && <Flag label="Tax line" />}
        {r.internal_only === "Y" && <Flag label="Internal" />}
      </>
    ),
    csv: flagText,
  },
  { key: "status", header: "Status", sortable: true, cell: (r) => <StatusBadge status={r.status} />, csv: (r) => r.status },
];

export function PrintTable({ rows }: { rows: PrintItem[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      config={PRINT_TABLE}
      rows={rows}
      ctx={{}}
      rowKey={(r) => r.item}
      emptyLabel="No printables match these filters."
      summary={(f) => `${f.length} item${f.length === 1 ? "" : "s"}`}
      minWidthClass="min-w-[640px]"
      groupBy={(r) => r.category}
      groupOrder={PRINT_CATEGORY_ORDER}
      csvFilename="print-tracker.csv"
    />
  );
}
