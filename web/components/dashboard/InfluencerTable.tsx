"use client";

import { useMemo, useState } from "react";
import type { InfluencerRow } from "@/lib/influencers/airtable";

// Client-side table for the influencer worklist: filter by segment + stage,
// link out to each contact's email/phone/official page, and export a CSV. Read
// from the Master Database "Influential Voters" table; edits happen there.

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
  const head = ["Name", "Title", "Organization", "Segment", "Stage", "Influence", "Outcome", "Email", "Phone", "Follow-up", "Next Action"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.name, r.title, r.org, r.segment, r.stage, r.influence, r.outcome, r.email, r.phone, r.followUp, r.nextAction].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

export function InfluencerTable({ rows }: { rows: InfluencerRow[] }) {
  const segments = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.segment).filter(Boolean)))], [rows]);
  const [segment, setSegment] = useState("All");
  const [openOnly, setOpenOnly] = useState(false);

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
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-slate/10 align-top">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
