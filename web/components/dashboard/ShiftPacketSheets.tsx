"use client";

import { ELECTION_DAY, type ShiftPacket, type ShiftRecord } from "@/lib/coverage/shifts";

// Print-only poll-coverage shift packets: one page per assigned greeter (their
// full chronological schedule + a check-in column) plus a final unfilled-shifts
// page. Rendered inside `.print-only .printable`, so it never appears on screen —
// the PrintButton on the shift board triggers window.print() and these become the
// printed document (globals.css @media print rules). INTERNAL ops doc: no public
// disclaimer, per the print-tracker's internal_only convention (like the sign
// turf packets and the run-of-show sheet).

const th = "border-b border-ink/40 px-2 py-1 text-left font-mono text-[0.6rem] uppercase tracking-eyebrow";
const td = "border-b border-ink/15 px-2 py-1 align-top";

const fmtDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// The §7 one-pager, restating candidate/poll-coverage-plan.md's already-verified
// conduct rules (RSMo 115.637 buffer verified July 10, 2026) — no new claims.
function ComplianceFooter() {
  return (
    <div className="mt-4 border border-ink/40 p-2 text-[0.65rem] leading-snug">
      <strong>Every shift (plan §7):</strong> stay ≥25 ft from the polling-place door and never inside
      (RSMo 115.637 — an Election-Day rule; at early-vote sites the posted site rules govern and we keep
      the same 25-ft discipline anyway) · greeting is NOT poll watching — no credentials, no challenges ·
      never block, follow, film, or argue with a voter — friendly reminder, then space · obey election
      judges and posted lines · log problems and report to your captain; don&apos;t confront. Rules change —
      re-verify with the election authority before your first shift.
    </div>
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

function ShiftsTable({ shifts, showAssignees }: { shifts: ShiftRecord[]; showAssignees?: boolean }) {
  const heads = ["Date", "Site", "Window", showAssignees ? "Assigned" : "With", "Notes", "Checked in (initials / time)"];
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {heads.map((h) => (
            <th key={h} className={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {shifts.map((s) => (
          <tr key={s.id}>
            <td className={`${td} whitespace-nowrap font-mono`}>
              {fmtDay(s.date)}
              {s.date === ELECTION_DAY ? <span className="block font-bold">Election Day</span> : null}
            </td>
            <td className={`${td} font-semibold`}>
              {s.site}
              {s.county ? <span className="block font-mono text-[0.6rem] font-normal">{s.county} County</span> : null}
            </td>
            <td className={td}>{s.window}</td>
            <td className={td}>
              {s.assignees.length ? s.assignees.map((a) => a.name).join(", ") : "—"}
              {s.assignees.length < s.needed ? <span className="block font-bold">needs {s.needed - s.assignees.length} more</span> : null}
            </td>
            <td className={td}>{s.notes ?? ""}</td>
            <td className={`${td} min-w-[7rem]`} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PacketPage({ packet, printedOn }: { packet: ShiftPacket; printedOn: string }) {
  return (
    <section className="print-page">
      <SheetHeader
        title={`Poll-coverage shifts — ${packet.name}`}
        sub={`${packet.shifts.length} shift${packet.shifts.length === 1 ? "" : "s"} · printed ${printedOn}`}
      />
      <ShiftsTable shifts={packet.shifts} />
      <ComplianceFooter />
    </section>
  );
}

export function ShiftPacketSheets({ packets, unfilled }: { packets: ShiftPacket[]; unfilled: ShiftRecord[] }) {
  // Print date stamped at render; a client component, so this is fine (and the
  // sheet is only ever seen through window.print()).
  const printedOn = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <article className="print-only printable text-ink" aria-hidden>
      {packets.map((p) => (
        <PacketPage key={p.assigneeId} packet={p} printedOn={printedOn} />
      ))}
      {unfilled.length > 0 && (
        <section className="print-page">
          <SheetHeader
            title="Unfilled shifts — recruit before promising coverage"
            sub={`${unfilled.length} shift${unfilled.length === 1 ? "" : "s"} still short of the needed greeters · an unstaffed site is uncovered (plan §4) · printed ${printedOn}`}
          />
          <ShiftsTable shifts={unfilled} showAssignees />
          <ComplianceFooter />
        </section>
      )}
    </article>
  );
}
