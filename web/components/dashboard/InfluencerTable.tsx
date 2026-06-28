"use client";

import { Fragment, useActionState, useMemo, useState } from "react";
import type { InfluencerRow } from "@/lib/influencers/airtable";
import { INFLUENCER_EDIT } from "@/lib/influencers/edit-options";
import { saveInfluencer, type InfluencerEditResult } from "@/app/dashboard/influencers/actions";

// Client-side table for the influencer worklist: filter by segment + stage, link out to each
// contact, export CSV, and (when `editable`) inline-edit the outreach pipeline. The synced
// mailing data is never editable here; only the pipeline fields the Front-End Access control
// table permits. Edits also still happen directly in Airtable.

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

function csv(rows: InfluencerRow[]): string {
  const head = ["Name", "Title", "Organization", "Segment", "Stage", "Influence", "Outcome", "Alignment", "Owner", "Email", "Phone", "Follow-up", "Next Action"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.name, r.title, r.org, r.segment, r.stage, r.influence, r.outcome, r.alignment, r.owner, r.email, r.phone, r.followUp, r.nextAction].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

function EditorRow({ row, onDone }: { row: InfluencerRow; onDone: () => void }) {
  const [res, action, saving] = useActionState<InfluencerEditResult | null, FormData>(saveInfluencer, null);
  const sel = "rounded border border-slate/30 px-2 py-1 text-sm";
  return (
    <form action={action} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
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

export function InfluencerTable({ rows, editable = false }: { rows: InfluencerRow[]; editable?: boolean }) {
  const segments = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.segment).filter(Boolean)))], [rows]);
  const [segment, setSegment] = useState("All");
  const [openOnly, setOpenOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (segment === "All" || r.segment === segment) &&
          (!openOnly || (r.outcome !== "Endorsed" && r.outcome !== "Declined")),
      ),
    [rows, segment, openOnly],
  );

  function exportCsv() {
    const blob = new Blob([csv(filtered)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mo02-influencers-${segment.toLowerCase().replace(/\W+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const colCount = editable ? 8 : 7;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {segments.map((s) => (
          <button
            key={s}
            onClick={() => setSegment(s)}
            className={`rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors ${
              segment === s ? "bg-gold/15 text-[#9a6f1a]" : "bg-slate/10 text-slate hover:bg-slate/15"
            }`}
          >
            {s}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-slate">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
        <span className="ml-auto text-xs text-slate">{filtered.length} of {rows.length}</span>
        <button onClick={exportCsv} className="rounded-sm bg-slate/10 px-3 py-1.5 text-xs font-semibold text-slate hover:bg-slate/15">
          Export CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate/15 text-xs uppercase tracking-eyebrow text-slate">
              <th className="px-3 py-2.5 font-mono">Infl.</th>
              <th className="px-3 py-2.5 font-mono">Name</th>
              <th className="px-3 py-2.5 font-mono">Role / Org</th>
              <th className="px-3 py-2.5 font-mono">Segment</th>
              <th className="px-3 py-2.5 font-mono">Stage</th>
              <th className="px-3 py-2.5 font-mono">Contact</th>
              <th className="px-3 py-2.5 font-mono">Follow-up</th>
              {editable && <th className="px-3 py-2.5 font-mono">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-b border-slate/10 align-top">
                  <td className="whitespace-nowrap px-3 py-2.5 text-gold" aria-label={`${r.influence} of 5`}>
                    {"★".repeat(r.influence)}<span className="text-slate/30">{"★".repeat(Math.max(0, 5 - r.influence))}</span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-ink">{r.name}</td>
                  <td className="px-3 py-2.5 text-slate">
                    {r.title}
                    {r.org ? <span className="block text-xs text-slate/70">{r.org}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate">{r.segment}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded-sm px-2 py-0.5 text-xs font-semibold ${STAGE_TONE[r.stage] ?? "bg-slate/10 text-slate"}`}>
                      {r.stage || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="flex flex-col gap-0.5">
                      {r.email ? <a className="text-[#9a6f1a] hover:underline" href={`mailto:${r.email}`}>{r.email}</a> : null}
                      {r.phone ? <a className="text-slate hover:underline" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a> : null}
                      {r.url ? <a className="text-slate hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">Official page ↗</a> : null}
                      {!r.email && !r.phone && !r.url ? <span className="text-slate/50">—</span> : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate">
                    {r.followUp || "—"}
                    {r.nextAction ? <span className="block text-xs text-slate/70">{r.nextAction}</span> : null}
                  </td>
                  {editable && (
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <button
                        onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                        className="btn-ghost px-2.5 py-1 text-xs"
                      >
                        {editingId === r.id ? "Close" : "Edit"}
                      </button>
                    </td>
                  )}
                </tr>
                {editable && editingId === r.id && (
                  <tr className="border-b border-slate/10 bg-slate/5">
                    <td colSpan={colCount} className="p-0">
                      <EditorRow row={r} onDone={() => setEditingId(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
