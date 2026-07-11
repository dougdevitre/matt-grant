"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { districtRollup, excludeBanked, filterVoters, votersToCsv, type ExportKind, type VoterFilters } from "@/lib/voters/dashboard";
import { SEGMENTS, type Segment } from "@/lib/voters/score";
import { AGE_BANDS, ageBand } from "@/lib/voters/parse";
import { allocateTurfs, cutTurfs } from "@/lib/voters/walk";
import type { StoredVoter, VoterAggRow } from "@/lib/voters/storeTypes";
import { CallSheetPages, WalkPacketSheets } from "@/components/dashboard/VoterPacketSheets";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import {
  fetchPrecinctVoters,
  recordCanvassIdsAction,
  recordCanvassPasteAction,
  syncTurfsToAirtableAction,
  type ActionState,
} from "@/app/dashboard/voters/actions";

// The voter command center (voter-file-plan.md Phase 2): district scoreboard +
// county mix from the VOTERAGG rollups, a sortable precinct table, and a
// per-precinct drill-down (voters fetched on demand — one bounded shard at a
// time) with filters and RSMo-stamped CSV exports built client-side. Aggregates
// arrive as a server prop and are consumed directly. Phase 4 adds printable
// walk packets (street-sorted 40-60-door turfs, captain-allocated) and
// manual-dial call sheets for phones matched from campaign records.

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

export function VotersExplorer({ aggs, captains = [] }: { aggs: VoterAggRow[]; captains?: { id: string; name: string }[] }) {
  const rollup = useMemo(() => districtRollup(aggs), [aggs]);
  const [countyFilter, setCountyFilter] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "PERSUADE" | "MOBILIZE" | "BANK">("count");
  const [open, setOpen] = useState<string | null>(null);
  const [voters, setVoters] = useState<StoredVoter[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  // Banked ballots (voterId -> votedAt). Hidden from lists by DEFAULT — the
  // chase doc's rule (mark banked AND remove from contact lists); the toggle
  // makes a deliberate include possible.
  const [banked, setBanked] = useState<Record<string, string>>({});
  const [hideBanked, setHideBanked] = useState(true);
  const [filters, setFilters] = useState<VoterFilters>({});
  const [pending, startTransition] = useTransition();
  // Which print-only sheet set is mounted (walk packets XOR call sheet). The
  // token makes a repeat click on the same button re-open the print dialog;
  // the effect fires only after React commits the selected sheets.
  const [printReq, setPrintReq] = useState<{ kind: "walk" | "call"; token: number } | null>(null);
  useEffect(() => {
    if (printReq) window.print();
  }, [printReq]);
  const requestPrint = (kind: "walk" | "call") => setPrintReq((p) => ({ kind, token: (p?.token ?? 0) + 1 }));

  const precincts = useMemo(() => {
    const rows = countyFilter ? aggs.filter((a) => a.county === countyFilter) : aggs;
    return [...rows].sort((a, b) =>
      sortBy === "count" ? b.count - a.count : (b.seg[sortBy] ?? 0) - (a.seg[sortBy] ?? 0),
    );
  }, [aggs, countyFilter, sortBy]);

  // Phase 5: canvass IDs staged per row, saved in one write-back that also
  // re-aggregates the precinct (segments below move on the re-fetch).
  const [pendingIds, setPendingIds] = useState<Record<string, number>>({});
  const [canvassMsg, setCanvassMsg] = useState<ActionState | null>(null);
  const [pasteText, setPasteText] = useState("");

  const drill = (key: string) => {
    setOpen(key);
    setVoters([]);
    setPhones({});
    setBanked({});
    setHideBanked(true);
    setFilters({});
    setPrintReq(null);
    setPendingIds({});
    setCanvassMsg(null);
    startTransition(async () => {
      const res = await fetchPrecinctVoters(key);
      setVoters(res.voters);
      setPhones(res.phones);
      setBanked(res.banked);
    });
  };

  const saveCanvassIds = () => {
    if (!open) return;
    const entries = Object.entries(pendingIds).map(([voterId, canvassId]) => ({ voterId, canvassId }));
    if (!entries.length) return;
    const fd = new FormData();
    fd.set("precinctKey", open);
    fd.set("entries", JSON.stringify(entries));
    startTransition(async () => {
      const res = await recordCanvassIdsAction({ ok: true, message: "" }, fd);
      setCanvassMsg(res);
      if (res.ok) {
        setPendingIds({});
        const fresh = await fetchPrecinctVoters(open);
        setVoters(fresh.voters);
        setPhones(fresh.phones);
        setBanked(fresh.banked);
      }
    });
  };

  // Bulk entry from a returned sheet — covers batches beyond the 500 on-screen
  // rows the per-row selectors render. Same write-back + refresh path.
  const submitCanvassPaste = () => {
    if (!open || !pasteText.trim()) return;
    const fd = new FormData();
    fd.set("precinctKey", open);
    fd.set("lines", pasteText);
    startTransition(async () => {
      const res = await recordCanvassPasteAction({ ok: true, message: "" }, fd);
      setCanvassMsg(res);
      if (res.ok) {
        setPasteText("");
        const fresh = await fetchPrecinctVoters(open);
        setVoters(fresh.voters);
        setPhones(fresh.phones);
        setBanked(fresh.banked);
      }
    });
  };

  const bankedShown = useMemo(
    () => filterVoters(voters, filters).filter((v) => v.voterId in banked).length,
    [voters, filters, banked],
  );
  const shown = useMemo(
    () => excludeBanked(filterVoters(voters, filters), banked, hideBanked),
    [voters, filters, banked, hideBanked],
  );
  // Walk turfs over the FILTERED list (street-sorted 40-60 doors), captains round-robin.
  const turfs = useMemo(() => allocateTurfs(cutTurfs(shown), captains), [shown, captains]);
  const matchedCount = useMemo(() => shown.filter((v) => phones[v.voterId]).length, [shown, phones]);

  // Airtable sync: only turf SUMMARIES (counts + captain) cross over — never
  // voter PII. The action is fail-closed on the base's Front-End Access table.
  const [syncState, syncAction] = useActionState(syncTurfsToAirtableAction, { ok: true, message: "" } as ActionState);
  const filtersLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.segment) parts.push(`segment=${filters.segment}`);
    if (filters.minT != null) parts.push(`T>=${filters.minT}`);
    if (filters.ageBand) parts.push(`age=${filters.ageBand}`);
    if (filters.street?.trim()) parts.push(`street~${filters.street.trim()}`);
    return parts.length ? parts.join(", ") : "all voters";
  }, [filters]);
  const turfJson = useMemo(
    () =>
      JSON.stringify(
        turfs.map((t) => ({
          index: t.index,
          total: turfs.length,
          doors: t.doors,
          voters: t.voters,
          ...(t.captain ? { captainName: t.captain.name } : {}),
        })),
      ),
    [turfs],
  );
  const exportCsv = (kind: ExportKind) => {
    if (!open) return;
    download(`${kind}-list-${open.replace(/[^a-z0-9]+/gi, "-")}.csv`, votersToCsv(shown, kind, phones));
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
              {pending
                ? "Loading voters…"
                : `${num(shown.length)} of ${num(voters.length)} voters${hideBanked && bankedShown ? ` · ${num(bankedShown)} banked hidden` : ""}`}
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              {(["walk", "mail", "call"] as const).map((k) => (
                <button key={k} onClick={() => exportCsv(k)} disabled={pending || !shown.length} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
                  Export {k} list
                </button>
              ))}
              <button
                onClick={() => requestPrint("walk")}
                disabled={pending || !turfs.length}
                className="no-print btn-ghost px-3 py-1 text-xs disabled:opacity-50"
              >
                Print walk packets ({turfs.length})
              </button>
              <button
                onClick={() => requestPrint("call")}
                disabled={pending || !matchedCount}
                className="no-print btn-ghost px-3 py-1 text-xs disabled:opacity-50"
                title={matchedCount ? undefined : "No phones matched from campaign records for this list"}
              >
                Print call sheet ({matchedCount})
              </button>
            </span>
          </div>
          <p className="mt-2 text-[0.7rem] text-slate">
            Walk packets cut the filtered list into street-sorted turfs of ~40-60 doors
            {captains.length ? ` and round-robin them across ${captains.length} active captains` : " (no active captains — walker line left blank)"}.
            Call sheet covers the {matchedCount} voters with a phone matched from campaign records (volunteers/donors) — manual dial only, never texting.
          </p>
          <form action={syncAction} className="mt-2 flex flex-wrap items-center gap-2 no-print">
            <input type="hidden" name="precinctLabel" value={open.split("#")[1] ?? open} />
            <input type="hidden" name="filtersLabel" value={filtersLabel} />
            <input type="hidden" name="matched" value={matchedCount} />
            <input type="hidden" name="turfs" value={turfJson} />
            <SubmitButton
              className="btn-ghost px-3 py-1 text-xs disabled:opacity-50"
              disabled={pending || !turfs.length}
              pendingText="Syncing…"
            >
              Sync counts to Airtable
            </SubmitButton>
            <span className="text-[0.7rem] text-slate">
              Pushes turf/door counts + captain to Canvass Turf (and the matched-phone count to Contact Lists) — never voter names or addresses.
            </span>
            {syncState.message && (
              <span className={`w-full text-[0.7rem] ${syncState.ok ? "text-field" : "text-brick"}`} role="status">
                {syncState.message}
              </span>
            )}
          </form>
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
            {Object.keys(banked).length > 0 && (
              <label className={`${chip} flex cursor-pointer items-center gap-1.5`}>
                <input type="checkbox" checked={hideBanked} onChange={(e) => setHideBanked(e.target.checked)} />
                Hide banked ({num(bankedShown)})
              </label>
            )}
          </div>
          {Object.keys(banked).length > 0 && (
            <p className="mt-2 text-[0.7rem] text-brick no-print">
              {num(Object.keys(banked).length)} voter{Object.keys(banked).length === 1 ? " in this precinct has" : "s in this precinct have"} already
              voted — lists and packets {hideBanked ? "exclude them" : "INCLUDE them (toggle re-checked hides them)"}. Packets printed before the
              last returns import still include them; reprint.
            </p>
          )}
          {/* Phase 5 write-back: stage 1-5 IDs per row (from returned walk sheets),
              save once — s/segment recompute server-side and the shard re-fetches. */}
          <div className="mt-2 flex flex-wrap items-center gap-2 no-print">
            <button
              onClick={saveCanvassIds}
              disabled={pending || !Object.keys(pendingIds).length}
              className="btn-ghost px-3 py-1 text-xs disabled:opacity-50"
            >
              Save {Object.keys(pendingIds).length || ""} canvass ID{Object.keys(pendingIds).length === 1 ? "" : "s"}
            </button>
            <span className="text-[0.7rem] text-slate">
              1 Strong Grant · 2 Lean · 3 Undecided · 4 Lean other · 5 Strong other — a saved ID replaces the party proxy and recomputes the segment.
            </span>
            {canvassMsg?.message && (
              <span className={`w-full text-[0.7rem] ${canvassMsg.ok ? "text-field" : "text-brick"}`} role="status">
                {canvassMsg.message}
              </span>
            )}
          </div>
          <details className="mt-2 no-print">
            <summary className="cursor-pointer select-none text-[0.7rem] font-semibold text-slate">
              Paste IDs from a returned sheet (bulk)
            </summary>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={4}
                placeholder={"voterId,canvassId — one per line, e.g.\n123456,1\n123457,3"}
                className="w-72 rounded-sm border border-line bg-white p-2 font-mono text-xs text-ink"
                aria-label="Bulk canvass IDs"
              />
              <button
                onClick={submitCanvassPaste}
                disabled={pending || !pasteText.trim()}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-50"
              >
                Save pasted IDs
              </button>
            </div>
          </details>
          <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-sm border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-slate">
                <tr>
                  {["Name", "Address", "City", "Age", "T", "Segment", "Last voted", "Canvass ID"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.slice(0, 500).map((v) => (
                  <tr key={v.voterId} className="hover:bg-paper">
                    <td className="px-3 py-1.5 text-ink">
                      {v.lastName}, {v.firstName}
                      {v.voterId in banked && (
                        <span className="ml-1.5 rounded-sm bg-field/15 px-1 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-field">
                          voted{banked[v.voterId] ? ` ${banked[v.voterId]}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-slate">{v.address}{v.unit ? ` ${v.unit}` : ""}</td>
                    <td className="px-3 py-1.5 text-slate">{v.city}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{ageBand(v.yob)}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{v.t}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{v.segment}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate">{v.lastVoted ? `${v.lastVoted.date}` : "—"}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={String(pendingIds[v.voterId] ?? v.canvassId ?? "")}
                        onChange={(e) =>
                          setPendingIds((p) => {
                            const next = { ...p };
                            const n = Number(e.target.value);
                            if (n >= 1 && n <= 5 && n !== v.canvassId) next[v.voterId] = n;
                            else delete next[v.voterId];
                            return next;
                          })
                        }
                        className={`rounded-sm border px-1 py-0.5 font-mono text-xs ${pendingIds[v.voterId] ? "border-gold bg-gold/10" : "border-line bg-white"}`}
                        aria-label={`Canvass ID for ${v.firstName} ${v.lastName}`}
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 500 && (
              <p className="px-3 py-2 text-[0.7rem] text-slate">Showing the first 500 on screen — exports include all {num(shown.length)}.</p>
            )}
          </div>
          {/* Print-only sheets — exactly one set mounted so window.print() is unambiguous. */}
          {printReq?.kind === "walk" && (
            <WalkPacketSheets turfs={turfs} precinctLabel={open.split("#")[1] ?? open} county={open.split("#")[0] ?? ""} />
          )}
          {printReq?.kind === "call" && (
            <CallSheetPages voters={shown} phones={phones} precinctLabel={open.split("#")[1] ?? open} county={open.split("#")[0] ?? ""} />
          )}
        </div>
      )}
    </div>
  );
}
