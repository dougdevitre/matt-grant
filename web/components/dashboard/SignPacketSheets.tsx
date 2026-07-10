"use client";

import type { Allocation, CaptainPacket, ScoredPlacement } from "@/lib/signs/placement";

// Print-only turf-packet sheets: one page per captain (their FULL ranked
// location list, gate marks, notes, and a blank placed-by column for field
// marking) plus a final needs-host page. Rendered inside `.print-only
// .printable`, so it never appears on screen — the PrintButton in the turf
// packets card triggers window.print() and these become the printed document
// (globals.css @media print rules). INTERNAL ops doc: no public disclaimer,
// per the print-tracker's internal_only convention (like the run-of-show sheet).

const gateMark = (on: boolean) => (on ? "✓" : "✗");

const th = "border-b border-ink/40 px-2 py-1 text-left font-mono text-[0.6rem] uppercase tracking-eyebrow";
const td = "border-b border-ink/15 px-2 py-1 align-top";

function ComplianceFooter() {
  return (
    <div className="mt-4 border border-ink/40 p-2 text-[0.65rem] leading-snug">
      <strong>Before every placement (plan §9):</strong> written property permission logged · never in
      a road right-of-way · on Election Day stay ≥25 ft from the polling-place door · follow election
      judges&apos; direction · note each municipality&apos;s removal deadline. A ✗ on any gate below means{" "}
      <strong>do not place</strong> until it&apos;s cleared.
    </div>
  );
}

function PlacementRows({ placements }: { placements: ScoredPlacement[] }) {
  return (
    <>
      {placements.map((p, i) => (
        <tr key={`${p.name}-${i}`}>
          <td className={`${td} font-mono`}>{i + 1}</td>
          <td className={`${td} font-semibold`}>
            {p.name}
            {p.precinct ? <span className="block font-mono text-[0.6rem] font-normal">{p.precinct}</span> : null}
          </td>
          <td className={td}>{p.type}</td>
          <td className={`${td} font-mono`}>{p.tier}</td>
          <td className={`${td} whitespace-nowrap font-mono`}>
            dist {gateMark(p.inDistrict)} · buf {gateMark(p.bufferVerified)} · perm {gateMark(p.propertyPermission)}
          </td>
          <td className={td}>{p.notes ?? ""}</td>
          <td className={`${td} min-w-[7rem]`} />
        </tr>
      ))}
    </>
  );
}

function SheetHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="mb-3 border-b-2 border-ink pb-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow">Matt Grant for Congress · Field · internal</p>
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <p className="text-xs">{sub}</p>
    </header>
  );
}

function LocationsTable({ placements }: { placements: ScoredPlacement[] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {["#", "Location", "Type", "Tier", "Gates", "Notes", "Placed (initials / date)"].map((h) => (
            <th key={h} className={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        <PlacementRows placements={placements} />
      </tbody>
    </table>
  );
}

function PacketPage({ packet, printedOn }: { packet: CaptainPacket; printedOn: string }) {
  return (
    <section className="print-page">
      <SheetHeader
        title={`Sign turf packet — ${packet.name || packet.captainId}`}
        sub={`Contact: ${packet.contact || packet.captainId} · ${packet.count} location${packet.count === 1 ? "" : "s"}${
          packet.signInventory != null ? ` · inventory ${packet.signInventory}` : ""
        } · printed ${printedOn}`}
      />
      {(packet.overCapacity || packet.overSpan) && (
        <p className="mb-2 border border-ink/40 p-2 text-xs font-semibold">
          {packet.overCapacity ? "⚠ More locations than on-hand inventory — confirm sign count before heading out. " : ""}
          {packet.overSpan ? "⚠ Over the span-of-control cap — consider splitting with a co-captain." : ""}
        </p>
      )}
      <LocationsTable placements={packet.placements} />
      <ComplianceFooter />
    </section>
  );
}

export function SignPacketSheets({ allocation }: { allocation: Allocation }) {
  // Print date stamped at render; a client component, so this is fine (and the
  // sheet is only ever seen through window.print()).
  const printedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <article className="print-only printable text-ink" aria-hidden>
      {allocation.packets.map((p) => (
        <PacketPage key={p.captainId} packet={p} printedOn={printedOn} />
      ))}
      {allocation.needsHost.length > 0 && (
        <section className="print-page">
          <SheetHeader
            title="Needs a host — unassigned locations"
            sub={`${allocation.needsHost.length} location${allocation.needsHost.length === 1 ? "" : "s"} with no matching captain · assign a captain_id or recruit a host before deploying · printed ${printedOn}`}
          />
          <LocationsTable placements={allocation.needsHost} />
          <ComplianceFooter />
        </section>
      )}
    </article>
  );
}
