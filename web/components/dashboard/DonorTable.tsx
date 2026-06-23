"use client";

import { useMemo, useState } from "react";
import type { DonorRow } from "@/lib/queries";
import { dollars, FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "@/lib/money";

const select = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink";

export function DonorTable({ rows }: { rows: DonorRow[] }) {
  const [q, setQ] = useState("");
  const [fec, setFec] = useState("ALL"); // ALL | MISSING | COMPLETE
  const [overOnly, setOverOnly] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((d) => {
      const missing = !d.employer || !d.occupation;
      if (fec === "MISSING" && !missing) return false;
      if (fec === "COMPLETE" && missing) return false;
      if (overOnly && d.totalCents <= FEC_INDIVIDUAL_PER_ELECTION_CENTS) return false;
      if (needle) {
        const hay = [d.name, d.city, d.email, d.employer, d.occupation].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, fec, overOnly]);

  const shownTotal = useMemo(() => filtered.reduce((s, d) => s + d.totalCents, 0), [filtered]);
  const missingCount = useMemo(() => rows.filter((d) => !d.employer || !d.occupation).length, [rows]);

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, city, employer, occupation…"
          aria-label="Search donors"
          className={`${select} min-w-[14rem] flex-1`}
        />
        <select value={fec} onChange={(e) => setFec(e.target.value)} aria-label="Filter by FEC info" className={select}>
          <option value="ALL">All FEC status</option>
          <option value="MISSING">Missing FEC info ({missingCount})</option>
          <option value="COMPLETE">FEC complete</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate">
          <input type="checkbox" checked={overOnly} onChange={(e) => setOverOnly(e.target.checked)} />
          Over limit only
        </label>
        <span className="font-mono text-xs text-slate">
          {filtered.length} of {rows.length} · {dollars(shownTotal)}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="p-8 text-center text-slate">No donors match these filters.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-paper text-left">
            <tr className="text-slate">
              <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Donor</th>
              <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Employer / Occ.</th>
              <th className="px-5 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((d) => {
              const overLimit = d.totalCents > FEC_INDIVIDUAL_PER_ELECTION_CENTS;
              const missingFec = !d.employer || !d.occupation;
              return (
                <tr key={d.id} className="hover:bg-paper">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-ink">{d.name}</p>
                    {d.city && <p className="text-xs text-slate">{d.city}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate">
                    {d.employer || d.occupation ? (
                      <span>
                        {d.employer ?? "—"} · {d.occupation ?? "—"}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-brick">⚠ FEC info missing</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {d.totalCents === 0 ? (
                      <span className="font-mono text-slate" title="No contribution amount on file — check the donation source (e.g. the WinRed webhook payload).">
                        — <span className="text-[0.6rem] uppercase tracking-eyebrow">no amount</span>
                      </span>
                    ) : (
                      <span className="font-mono font-semibold text-ink">{dollars(d.totalCents)}</span>
                    )}
                    {overLimit && (
                      <span className="ml-2 rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-brick">
                        over limit
                      </span>
                    )}
                    {!overLimit && missingFec && d.totalCents > 20000 && (
                      <span className="ml-2 font-mono text-[0.6rem] text-brick">check FEC</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
