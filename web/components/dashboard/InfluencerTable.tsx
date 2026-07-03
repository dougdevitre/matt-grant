"use client";

import { useActionState } from "react";
import type { InfluencerRow } from "@/lib/influencers/airtable";
import { INFLUENCER_EDIT } from "@/lib/influencers/edit-options";
import { saveInfluencer, type InfluencerEditResult } from "@/app/dashboard/influencers/actions";
import { DataTable } from "@/components/dashboard/DataTable";
import { INFLUENCER_TABLE } from "@/lib/table/influencers-config";
import type { ColumnDef } from "@/lib/table/types";
import type { ExportColumn } from "@/lib/table/view";

// CSV export keeps every discrete field the old bespoke export had — including the
// outreach-pipeline fields (Outcome/Alignment/Owner) that the compact table cells
// merge or omit — so the download stays a complete worklist, not just what's shown.
const CSV_COLUMNS: ExportColumn<InfluencerRow>[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Title", value: (r) => r.title },
  { header: "Organization", value: (r) => r.org },
  { header: "Segment", value: (r) => r.segment },
  { header: "Stage", value: (r) => r.stage },
  { header: "Influence", value: (r) => String(r.influence) },
  { header: "Outcome", value: (r) => r.outcome },
  { header: "Alignment", value: (r) => r.alignment },
  { header: "Owner", value: (r) => r.owner },
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "Follow-up", value: (r) => r.followUp },
  { header: "Next Action", value: (r) => r.nextAction },
];

// Influencer worklist on the shared <DataTable>: full-text search + segment/stage
// facets + saved views + column sort from the engine, plus (when `editable`) an
// inline pipeline editor in an expandable row. The synced mailing data is never
// editable here; only the pipeline fields the Front-End Access table permits.

const STAGE_TONE: Record<string, string> = {
  "Not Started": "bg-slate/10 text-slate",
  Researched: "bg-blue-100 text-blue-800",
  "Warm Intro": "bg-cyan-100 text-cyan-800",
  "Meeting Requested": "bg-yellow-100 text-yellow-900",
  "Meeting Held": "bg-teal-100 text-teal-900",
  "Ask Made": "bg-orange-100 text-orange-900",
  Activated: "bg-green-100 text-green-800",
  "Surrogate Deployed": "bg-purple-100 text-purple-800",
  "Maintain / Hold": "bg-slate/10 text-slate",
};

function EditorRow({ row, onDone }: { row: InfluencerRow; onDone: () => void }) {
  const [res, action, saving] = useActionState<InfluencerEditResult | null, FormData>(saveInfluencer, null);
  const sel = "rounded border border-slate/30 px-2 py-1 text-sm";
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="id" value={row.id} />
      <label className="text-xs text-slate">
        {INFLUENCER_EDIT.stage.label}
        <select name="stage" defaultValue={row.stage} className={`mt-1 block w-full ${sel}`}>
          <option value="">—</option>
          {INFLUENCER_EDIT.stage.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate">
        {INFLUENCER_EDIT.outcome.label}
        <select name="outcome" defaultValue={row.outcome} className={`mt-1 block w-full ${sel}`}>
          <option value="">—</option>
          {INFLUENCER_EDIT.outcome.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate">
        {INFLUENCER_EDIT.alignment.label}
        <select name="alignment" defaultValue={row.alignment} className={`mt-1 block w-full ${sel}`}>
          <option value="">—</option>
          {INFLUENCER_EDIT.alignment.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate">
        Owner
        <input name="owner" defaultValue={row.owner} className={`mt-1 block w-full ${sel}`} />
      </label>
      <label className="text-xs text-slate">
        Follow-up Date
        <input type="date" name="followUp" defaultValue={row.followUp} className={`mt-1 block w-full ${sel}`} />
      </label>
      <label className="text-xs text-slate">
        Next Action
        <input name="nextAction" defaultValue={row.nextAction} className={`mt-1 block w-full ${sel}`} />
      </label>
      <label className="text-xs text-slate sm:col-span-2 lg:col-span-3">
        Notes
        <textarea name="notes" defaultValue={row.notes} rows={2} className={`mt-1 block w-full ${sel}`} />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={saving} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className="btn-ghost px-3 py-1 text-xs">Cancel</button>
        {res && <span className={`text-xs ${res.ok ? "text-emerald-700" : "text-red-600"}`}>{res.message}</span>}
      </div>
    </form>
  );
}

// Visible columns are display-only; CSV export is driven by CSV_COLUMNS above.
const COLUMNS: ColumnDef<InfluencerRow>[] = [
  {
    key: "influence",
    header: "Infl.",
    sortable: true,
    cell: (r) => (
      <span className="whitespace-nowrap text-gold" aria-label={`${r.influence} of 5`}>
        {"★".repeat(r.influence)}
        <span className="text-slate/30">{"★".repeat(Math.max(0, 5 - r.influence))}</span>
      </span>
    ),
  },
  { key: "name", header: "Name", sortable: true, cell: (r) => <span className="font-semibold text-ink">{r.name}</span> },
  {
    key: "role",
    header: "Role / Org",
    cell: (r) => (
      <span className="text-slate">
        {r.title}
        {r.org ? <span className="block text-xs text-slate/70">{r.org}</span> : null}
      </span>
    ),
  },
  { key: "segment", header: "Segment", cell: (r) => <span className="whitespace-nowrap text-slate">{r.segment}</span> },
  {
    key: "stage",
    header: "Stage",
    cell: (r) => (
      <span className={`whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-semibold ${STAGE_TONE[r.stage] ?? "bg-slate/10 text-slate"}`}>
        {r.stage || "—"}
      </span>
    ),
  },
  {
    key: "contact",
    header: "Contact",
    cell: (r) => (
      <div className="flex flex-col gap-0.5 text-xs">
        {r.email ? <a className="text-gold-ink hover:underline" href={`mailto:${r.email}`}>{r.email}</a> : null}
        {r.phone ? <a className="text-slate hover:underline" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a> : null}
        {r.url ? <a className="text-slate hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">Official page ↗</a> : null}
        {!r.email && !r.phone && !r.url ? <span className="text-slate/50">—</span> : null}
      </div>
    ),
  },
  {
    key: "followUp",
    header: "Follow-up",
    sortable: true,
    cell: (r) => (
      <span className="whitespace-nowrap text-slate">
        {r.followUp || "—"}
        {r.nextAction ? <span className="block text-xs text-slate/70">{r.nextAction}</span> : null}
      </span>
    ),
  },
];

export function InfluencerTable({ rows, editable = false }: { rows: InfluencerRow[]; editable?: boolean }) {
  return (
    <DataTable
      columns={COLUMNS}
      config={INFLUENCER_TABLE}
      rows={rows}
      ctx={{}}
      rowKey={(r) => r.id}
      emptyLabel="No influencers match these filters."
      summary={(f) => `${f.length} of ${rows.length}`}
      minWidthClass="min-w-[60rem]"
      csvColumns={CSV_COLUMNS}
      csvFilename="mo02-influencers.csv"
      renderDetail={editable ? (row, _ctx, close) => <EditorRow row={row} onDone={close} /> : undefined}
    />
  );
}
