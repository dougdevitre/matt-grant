"use client";

import { DataTable } from "@/components/dashboard/DataTable";
import { SUBSCRIBER_TABLE } from "@/lib/table/subscribers-config";
import { TOPICS, type SubscriberRow } from "@/lib/subscribers-shared";
import type { ColumnDef } from "@/lib/table/types";

const topicLabel: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));
const statusStyle: Record<string, string> = {
  subscribed: "bg-field/10 text-field",
  unsubscribed: "bg-ink/10 text-slate",
  bounced: "bg-brick/10 text-brick",
  complained: "bg-brick/10 text-brick",
};
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const optedOut = (r: SubscriberRow) =>
  r.status === "subscribed" ? (r.optOut.length ? r.optOut.map((t) => topicLabel[t] ?? t).join(", ") : "—") : "all (global)";

const COLUMNS: ColumnDef<SubscriberRow>[] = [
  {
    key: "email",
    header: "Email",
    sortable: true,
    cell: (r) => <span className="font-mono text-xs text-ink">{r.email}</span>,
    csv: (r) => r.email,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    cell: (r) => (
      <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${statusStyle[r.status] ?? "bg-ink/5 text-slate"}`}>
        {r.status}
      </span>
    ),
    csv: (r) => r.status,
  },
  {
    key: "optOut",
    header: "Opted out of",
    cell: (r) => <span className="text-slate">{optedOut(r)}</span>,
    csv: (r) => optedOut(r),
  },
  {
    key: "updated",
    header: "Updated",
    align: "right",
    sortable: true,
    cell: (r) => <span className="font-mono text-[0.65rem] text-slate">{when(r.updatedAt)}</span>,
    csv: (r) => r.updatedAt ?? "",
  },
];

export function SubscriberTable({ rows }: { rows: SubscriberRow[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      config={SUBSCRIBER_TABLE}
      rows={rows}
      ctx={{}}
      rowKey={(r) => r.email}
      emptyLabel="No suppressions or opt-outs match these filters."
      summary={(f) => `${f.length} address${f.length === 1 ? "" : "es"}`}
      csvFilename="subscribers.csv"
    />
  );
}
