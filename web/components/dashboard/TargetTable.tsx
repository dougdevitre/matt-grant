"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { scoreRows, type PrecinctRow, type ScoredRow, type Strategy } from "@/lib/precincts";
import { csvField } from "@/lib/table/view";

const tierColor: Record<ScoredRow["tier"], string> = {
  A: "bg-brick/12 text-brick",
  B: "bg-gold/20 text-blue-ink",
  C: "bg-line text-slate",
};
const playColor: Record<ScoredRow["play"], string> = {
  Persuade: "text-field",
  "Persuade + GOTV": "text-blue-ink",
  Mobilize: "text-brick",
};

// Optional voter-file join from the server (voter-file-plan.md Phase 3):
// precinct name → PERSUADE universe + heuristic primary propensity (0..1).
// Undefined until the voter ingest has run — the table renders without the columns.
export type VoterJoin = Record<string, { persuade: number; vPropensity: number }>;

function toCsv(rows: ScoredRow[], strategy: Strategy, voter?: VoterJoin): string {
  const head = ["rank", "precinct", "municipality", "registered", "turnout_pct", "expected_ballots", "gotv_upside", "tier", "play"];
  if (voter) head.push("persuade_universe", "primary_propensity");
  const lines = rows.map((r) => {
    const cells: (string | number)[] = [r.rank, r.name, r.municipality, r.registered, r.turnout ?? "", r.expected, r.gotv, r.tier, r.play];
    if (voter) {
      const v = voter[r.name];
      cells.push(v ? v.persuade : "", v ? v.vPropensity.toFixed(2) : "");
    }
    return cells.map((v) => csvField(String(v))).join(",");
  });
  return [`# MO-02 precinct targets · strategy=${strategy} · Aug 2024 primary turnout`, head.join(","), ...lines].join("\n");
}

export function TargetTable({ rows, highlight, voter }: { rows: PrecinctRow[]; highlight?: string; voter?: VoterJoin }) {
  const [strategy, setStrategy] = useState<Strategy>("votes");
  const [muni, setMuni] = useState("");
  const [limit, setLimit] = useState(50);
  const hlRow = useRef<HTMLTableRowElement>(null);

  const { scored, medianTurnout, totals } = useMemo(() => scoreRows(rows, strategy), [rows, strategy]);

  // Deep-linked from the 3D map (?precinct=…): clear any muni filter, make sure
  // the row is within the shown limit, then scroll + flash it.
  const hl = highlight?.trim().toLowerCase();
  const hlIdx = useMemo(() => (hl ? scored.findIndex((r) => r.name.toLowerCase() === hl) : -1), [hl, scored]);
  useEffect(() => {
    if (hlIdx >= 0) {
      setMuni("");
      setLimit((l) => Math.max(l, hlIdx + 1));
    }
  }, [hlIdx]);
  useEffect(() => {
    if (hlIdx >= 0) hlRow.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hlIdx, limit]);

  const munis = useMemo(
    () => Array.from(new Set(rows.map((r) => r.municipality).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => (muni ? scored.filter((r) => r.municipality === muni) : scored), [scored, muni]);
  const shown = filtered.slice(0, limit);
  const coverage = !muni && shown.length ? shown[shown.length - 1].cumPct : null;

  const download = () => {
    const blob = new Blob([toCsv(filtered, strategy, voter)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mo02-targets-${strategy}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const metricLabel = strategy === "votes" ? "Expected ballots" : "GOTV upside";

  return (
    <>
      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-sm border border-line">
          {(["votes", "gotv"] as Strategy[]).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                strategy === s ? "bg-ink text-paper" : "bg-white text-slate hover:text-ink"
              }`}
            >
              {s === "votes" ? "Where the votes are" : "GOTV upside"}
            </button>
          ))}
        </div>
        <select
          value={muni}
          onChange={(e) => setMuni(e.target.value)}
          aria-label="Filter by municipality"
          className="rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink"
        >
          <option value="">All municipalities</option>
          {munis.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          aria-label="Number of targets to show"
          className="rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink"
        >
          {[25, 50, 100, 9999].map((n) => (
            <option key={n} value={n}>{n === 9999 ? "All" : `Top ${n}`}</option>
          ))}
        </select>
        <button onClick={download} className="btn-ghost ml-auto">Download CSV</button>
      </div>

      {/* Summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="eyebrow text-slate">{metricLabel} — district</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">
            {(strategy === "votes" ? totals.expected : rows.reduce((s, r) => s + r.gotv, 0)).toLocaleString()}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-slate">Median primary turnout</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink">{medianTurnout}%</p>
        </div>
        <div className="card p-4">
          <p className="eyebrow text-slate">Concentration</p>
          <p className="mt-1 text-sm text-ink">
            {coverage != null ? (
              <>
                Top {shown.length} precincts ≈ <strong>{coverage}%</strong> of {metricLabel.toLowerCase()}.
              </>
            ) : (
              <>{shown.length} precincts shown{muni ? ` in ${muni}` : ""}.</>
            )}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper text-left text-slate">
              <tr>
                {["#", "Precinct", "Municipality", "Reg.", "Turnout", metricLabel, "Tier", "Play", ...(voter ? ["Persuade", "Prim. prop."] : []), "Map"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => {
                const isHl = hl != null && r.name.toLowerCase() === hl;
                return (
                <tr
                  key={r.name}
                  ref={isHl ? hlRow : undefined}
                  className={isHl ? "bg-brick/10 ring-2 ring-inset ring-brick" : "hover:bg-paper"}
                >
                  <td className="px-4 py-2.5 font-mono text-slate">{r.rank}</td>
                  <td className="px-4 py-2.5 font-semibold text-ink">{r.name}</td>
                  <td className="px-4 py-2.5 text-slate">{r.municipality || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-ink">{r.registered.toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-mono text-ink">{r.turnout != null ? `${r.turnout}%` : "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-ink">
                    {(strategy === "votes" ? r.expected : r.gotv).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.65rem] font-bold ${tierColor[r.tier]}`}>{r.tier}</span>
                  </td>
                  <td className={`px-4 py-2.5 font-mono text-[0.7rem] uppercase tracking-eyebrow ${playColor[r.play]}`}>{r.play}</td>
                  {voter && (
                    <>
                      <td className="px-4 py-2.5 font-mono text-ink">
                        {voter[r.name] ? voter[r.name].persuade.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-ink">
                        {voter[r.name] ? `${Math.round(voter[r.name].vPropensity * 100)}%` : "—"}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2.5">
                    {/* Back-link to the 3D map, zoomed + pulsed on this precinct */}
                    <a
                      href={`/dashboard/map?precinct=${encodeURIComponent(r.name)}`}
                      className="font-mono text-[0.7rem] font-bold text-field hover:underline"
                      aria-label={`Show ${r.name} on the 3D map`}
                    >
                      Map →
                    </a>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
