"use client";

import { ageBand } from "@/lib/voters/parse";
import { RSMO_NOTICE } from "@/lib/voters/dashboard";
import { CANVASS_ID_KEY, type WalkTurf } from "@/lib/voters/walk";
import type { StoredVoter } from "@/lib/voters/storeTypes";

// Print-only canvass sheets (voter-file-plan.md Phase 4): one page-set per walk
// turf (street-sorted doors, the 1-5 canvass-ID column filled at the door and
// written back in Phase 5) plus manual-dial call sheets for matched phones.
// Rendered inside `.print-only .printable` so it never appears on screen — the
// PrintButton triggers window.print() (globals.css @media print rules).
// INTERNAL ops doc: no public disclaimer, per the turf-packet convention.
// RSMo 115.157: every page carries the political-use-only notice.

const th = "border-b border-ink/40 px-1.5 py-1 text-left font-mono text-[0.55rem] uppercase tracking-eyebrow";
const td = "border-b border-ink/15 px-1.5 py-0.5 align-top";

function SheetHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-2 border-b-2 border-ink pb-1.5">
      <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow">Matt Grant for Congress · Field · internal</p>
      <h1 className="font-display text-lg font-semibold">{title}</h1>
      <p className="text-[0.7rem]">{sub}</p>
    </header>
  );
}

function RsmoFooter({ extra }: { extra?: string }) {
  return (
    <div className="mt-3 border border-ink/40 p-2 text-[0.6rem] leading-snug">
      <p>{RSMO_NOTICE}</p>
      {extra && <p className="mt-1 font-semibold">{extra}</p>}
    </div>
  );
}

function TurfPage({ turf, turfCount, precinctLabel, county, printedOn }: {
  turf: WalkTurf;
  turfCount: number;
  precinctLabel: string;
  county: string;
  printedOn: string;
}) {
  return (
    <section className="print-page">
      <SheetHeader
        title={`Walk packet — ${precinctLabel} · Turf ${turf.index} of ${turfCount}`}
        sub={`${county} County · ${turf.doors} doors / ${turf.voters} voters · Walker: ${
          turf.captain ? `${turf.captain.name} (${turf.captain.id})` : "____________________ (unassigned)"
        } · printed ${printedOn}`}
      />
      <p className="mb-1.5 font-mono text-[0.6rem]">{CANVASS_ID_KEY} · NH = not home</p>
      <table className="w-full border-collapse text-[0.65rem]">
        <thead>
          <tr>
            {["Address", "Name", "Age", "T", "Seg", "ID (1-5)", "NH", "Notes"].map((h) => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {turf.households.map((h, hi) =>
            h.voters.map((v, vi) => (
              <tr key={v.voterId} className={hi % 2 ? "" : "bg-ink/[0.04]"}>
                <td className={`${td} whitespace-nowrap font-semibold`}>
                  {vi === 0 ? `${h.address}${h.unit ? ` ${h.unit}` : ""}` : ""}
                </td>
                <td className={td}>{v.lastName}, {v.firstName}</td>
                <td className={`${td} font-mono`}>{ageBand(v.yob)}</td>
                <td className={`${td} font-mono`}>{v.t}</td>
                <td className={`${td} font-mono`}>{v.segment.slice(0, 4)}</td>
                <td className={`${td} min-w-[3rem]`} />
                <td className={`${td} min-w-[2rem]`} />
                <td className={`${td} min-w-[6rem]`} />
              </tr>
            )),
          )}
        </tbody>
      </table>
      <RsmoFooter extra="Return this sheet to your captain after the shift — IDs get entered the same day (Phase 5 write-back)." />
    </section>
  );
}

export function WalkPacketSheets({ turfs, precinctLabel, county }: {
  turfs: WalkTurf[];
  precinctLabel: string;
  county: string;
}) {
  const printedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <article className="print-only printable text-ink" aria-hidden>
      {turfs.map((t) => (
        <TurfPage key={t.index} turf={t} turfCount={turfs.length} precinctLabel={precinctLabel} county={county} printedOn={printedOn} />
      ))}
    </article>
  );
}

/** Manual-dial call sheet: ONLY voters with a phone matched from campaign
 *  records (volunteers/donors who gave us their number). Never for texting. */
export function CallSheetPages({ voters, phones, precinctLabel, county }: {
  voters: StoredVoter[];
  phones: Record<string, string>;
  precinctLabel: string;
  county: string;
}) {
  const matched = voters.filter((v) => phones[v.voterId]);
  const printedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!matched.length) return null;
  return (
    <article className="print-only printable text-ink" aria-hidden>
      <section className="print-page">
        <SheetHeader
          title={`Call sheet — ${precinctLabel}`}
          sub={`${county} County · ${matched.length} matched phones (of ${voters.length} voters shown) · printed ${printedOn}`}
        />
        <table className="w-full border-collapse text-[0.65rem]">
          <thead>
            <tr>
              {["Name", "Phone (matched)", "City", "T", "Seg", "Result / notes"].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matched.map((v) => (
              <tr key={v.voterId}>
                <td className={`${td} font-semibold`}>{v.lastName}, {v.firstName}</td>
                <td className={`${td} font-mono`}>{phones[v.voterId]}</td>
                <td className={td}>{v.city}</td>
                <td className={`${td} font-mono`}>{v.t}</td>
                <td className={`${td} font-mono`}>{v.segment.slice(0, 4)}</td>
                <td className={`${td} min-w-[10rem]`} />
              </tr>
            ))}
          </tbody>
        </table>
        <RsmoFooter extra="MANUAL DIAL ONLY. These numbers came from campaign records (volunteers/donors), matched by name + ZIP — never text this list; broadcast texting requires the person's own opt-in (TCPA)." />
      </section>
    </article>
  );
}
