"use client";

import { useMemo, useState, useTransition } from "react";
import { districtRollup, filterVoters, votersToCsv, type ExportKind, type VoterFilters } from "@/lib/voters/dashboard";
import { SEGMENTS, type Segment } from "@/lib/voters/score";
import { AGE_BANDS, ageBand } from "@/lib/voters/parse";
import type { StoredVoter, VoterAggRow } from "@/lib/voters/storeTypes";
import { fetchPrecinctVoters } from "@/app/dashboard/voters/actions";

// The voter command center (voter-file-plan.md Phase 2): district scoreboard +
// county mix from the VOTERAGG rollups, a sortable precinct table, and a
// per-precinct drill-down (voters fetched on demand — one bounded shard at a
// time) with filters and RSMo-stamped CSV exports built client-side. Aggregates
// arrive as a server prop and are consumed directly.

const num = (n: number) => n.toLocaleString("en-US");
const chip = "rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "brick" | "field" }) {
  return (
    <div className="card p-4">
      <p className={`font-display text-2xl ${tone === "brick" ? "text-brick" : tone === "field" ? "text-field" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">{label}</p>
    </div>
  );
}

function download(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function VotersExplorer({ aggs }: { aggs: VoterAggRow[] }) {
  const rollup = useMemo(() => districtRollup(aggs), [aggs]);
  const [countyFilter, setCountyFilter] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "PERSUADE" | "MOBILIZE" | "BANK">("count");
  const [open, setOpen] = useState<string | null>(null);
  const [voters, setVoters] = useState<StoredVoter[]>([]);
  const [filters, setFilters] = useState<VoterFilters>({});
  const [pending, startTransition] = useTransition();

  const precincts = useMemo(() => {
    const rows = countyFilter ? aggs.filter((a) => a.county === countyFilter) : aggs;
    return [...rows].sort((a, b) =>
      sortBy === "count" ? b.count - a.count : (b.seg[sortBy] ?? 0) - (a.seg[sortBy] ?? 0),
    );
  }, [aggs, countyFilter, sortBy]);

  const drill = (key: string) => {
    setOpen(key);
    setVoters([]);
    setFilters({});
    startTransition(async () => {
      setVoters(await fetchPrecinctVoters(key));
    });
  };

  const shown = useMemo(() => filterVoters(voters, filters), [voters, filters]);
  const exportCsv = (kind: ExportKind) => {
    if (!open) return;
    download(`${kind}-list-${open.replace(/[^a-z0-9]+/gi, "-")}.csv`, votersToCsv(shown, kind));
  };

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Registered voters" value={num(rollup.voters)} />
        <Stat label="Active" value={num(rollup.active)} />
        <Stat label="Persuade universe" value={num(rollup.seg.PERSUADE)} tone="brick" />
        <Stat label="Bank + Mobilize" value={num(rollup.seg.BANK + rollup.seg.MOBILIZE)} tone="field" />
        <Stat label="New registrants" value={num(rollup.newReg)} />
        <Stat label="Precincts" value={num(rollup.precincts)} />
      </div>

      <div className="card overflow-hidden p-0">
        <p className="eyebrow px-5 pt-4 text-slate">Counties</p>
        <table className="mt-2 w-full text-sm">
          <tbody className="divide-y divide-line">
            {rollup.byCounty.map((c) => (
              <tr key={c.county} className="hover:bg-paper">
                <td className="px-5 py-2 text-ink">{c.county}</td>
                <td className="px-5 py-2 text-right font-mono text-xs text-slate">{num(c.voters)}</td>
                <td className="px-5 py-2 text-right font-mono text-xs text-slate">{(100 * c.share).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4 no-print">
          <p className="eyebrow text-slate">Precincts</p>
          <select value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)} className={chip} aria-label="Filter by county">
            <option value="">All counties</option>
            {rollup.byCounty.map((c) => (
              <option key={c.county} value={c.county}>{c.county}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={chip} aria-label="Sort precincts">
            <option value="count">Sort: voters</option>
            <option value="PERSUADE">Sort: persuade</option>
            <option value="MOBILIZE">Sort: mobilize</option>
            <option value="BANK">Sort: bank</option>
          </select>
        </div>
        <div className="mt-2 max-h-[46vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-slate">
              <tr>
                {["Precinct", "County", "Voters", "Persuade", "Mobilize", "Bank", ""].map((h, i) => (
                  <th key={`${h}${i}`} className="whitespace-nowrap px-4 py-2 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {precincts.map((a) => (
                <tr key={a.precinctKey} className={`hover:bg-paper ${open === a.precinctKey ? "bg-gold/10" : ""}`}>
                  <td className="px-4 py-2 text-ink">{a.precinctKey.split("#")[1]}</td>
                  <td className="px-4 py-2 text-slate">{a.county}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{num(a.count)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{num(a.seg.PERSUADE ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{num(a.seg.MOBILIZE ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{num(a.seg.BANK ?? 0)}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => drill(a.precinctKey)} className="font-mono text-[0.7rem] font-bold text-brick hover:underline">
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-lg text-ink">{open.split("#")[1]}</p>
            <span className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">{open.split("#")[0]}</span>
            <span className="text-xs text-slate">
              {pending ? "Loading voters…" : `${num(shown.length)} of ${num(voters.length)} voters`}
            </span>
            <span className="ml-auto flex gap-2">
              {(["walk", "mail", "call"] as const).map((k) => (
                <button key={k} onClick={() => exportCsv(k)} disabled={pending || !shown.length} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
                  Export {k} list
                </button>
              ))}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 no-print">
            <select value={filters.segment ?? ""} onChange={(e) => setFilters({ ...filters, segment: e.target.value as Segment | "" })} className={chip} aria-label="Segment">
              <option value="">All segments</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={String(filters.minT ?? "")} onChange={(e) => setFilters({ ...filters, minT: e.target.value ? Number(e.target.value) : undefined })} className={chip} aria-label="Minimum turnout score">
              <option value="">Any T</option>
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>T ≥ {t}</option>
              ))}
            </select>
            <select value={filters.ageBand ?? ""} onChange={(e) => setFilters({ ...filters, ageBand: e.target.value as VoterFilters["ageBand"] })} className={chip} aria-label="Age band">
              <option value="">All ages</option>
              {AGE_BANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input type="text" value={filters.street ?? ""} onChange={(e) => setFilters({ ...filters, street: e.target.value })} placeholder="Street contains…" className={`${chip} w-44`} aria-label="Street filter" />
          </div>
          <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-sm border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-slate">
                <tr>
                  {["Name", "Address", "City", "Age", "T", "Segment", "Last voted"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.slice(0, 500).map((v) => (
                  <tr key={v.voterId} className="hover:bg-paper">
                    <td className="px-3 py-1.5 text-ink">{v.lastName}, {v.firstName}</td>
                    <td className="px-3 py-1.5 text-slate">{v.address}{v.unit ? ` ${v.unit}` : ""}</td>
                    <td className="px-3 py-1.5 text-slate">{v.city}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{ageBand(v.yob)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{v.t}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{v.segment}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate">{v.lastVoted ? `${v.lastVoted.date}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 500 && (
              <p className="px-3 py-2 text-[0.7rem] text-slate">Showing the first 500 on screen — exports include all {num(shown.length)}.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
