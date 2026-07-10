"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { ShiftPacketSheets } from "@/components/dashboard/ShiftPacketSheets";
import {
  coverageGrid,
  DEFAULT_EARLY_WINDOWS,
  DEFAULT_ELECTION_DAY_WINDOWS,
  EARLY_VOTE_START,
  ELECTION_DAY,
  fillStats,
  shiftPackets,
  shiftStatus,
  type ShiftRecord,
  type ShiftStatus,
} from "@/lib/coverage/shifts";
import {
  assignShift,
  generateShiftsAction,
  removeShift,
  sendShiftRemindersAction,
  setShiftNeeded,
  setShiftNotes,
  type ShiftRemindersState,
  type ShiftsGenerateState,
} from "@/app/dashboard/coverage/actions";

// The poll-coverage shift board (candidate/poll-coverage-plan.md §4–§5): generate
// the site × day × window schedule, assign greeters per cell, and print per-person
// shift packets. Shifts arrive as a server prop and are consumed directly — every
// action revalidates the page, so the prop IS the state (never copied into useState).

export type AssigneeOption = { id: string; name: string; hint?: string };

const IDLE: ShiftsGenerateState = { ok: false, message: "" };

const STATUS_CLS: Record<ShiftStatus, string> = {
  covered: "bg-field/10 text-field",
  partial: "bg-gold/15 text-ink",
  uncovered: "bg-brick/10 text-brick",
};

const fmtDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function StatChip({ label, value, tone }: { label: string; value: string | number; tone?: "brick" | "field" }) {
  return (
    <div className="card px-4 py-3">
      <p className={`font-display text-xl ${tone === "brick" ? "text-brick" : tone === "field" ? "text-field" : "text-ink"}`}>{value}</p>
      <p className="mt-0.5 text-[0.65rem] uppercase tracking-eyebrow text-slate">{label}</p>
    </div>
  );
}

function GenerateCard({ prefillSites, connected }: { prefillSites: string; connected: boolean }) {
  const [state, action] = useActionState(generateShiftsAction, IDLE);
  return (
    <div className="card p-5">
      <p className="eyebrow text-slate">Generate the schedule</p>
      <p className="mt-1 max-w-2xl text-sm text-slate">
        One line per site, optionally <span className="font-mono">Site name, County</span>. Every site × day gets the
        early-vote windows; Election Day ({fmtDay(ELECTION_DAY)}) gets its own peak windows. Re-running only adds
        cells that aren&rsquo;t on the board yet — nothing is duplicated or overwritten.
      </p>
      <form action={action} className="mt-4 grid gap-3">
        <textarea
          name="sites"
          rows={6}
          defaultValue={prefillSites}
          placeholder={"St. Louis County BOE — St. Ann, St. Louis\nJefferson County Clerk — Hillsboro, Jefferson"}
          aria-label="Sites, one per line"
          className="w-full rounded-sm border border-line bg-white p-3 font-mono text-xs text-ink"
        />
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1 text-[0.65rem] uppercase tracking-eyebrow text-slate">
            First day
            <input type="date" name="start" defaultValue={EARLY_VOTE_START} className="rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink" />
          </label>
          <label className="grid gap-1 text-[0.65rem] uppercase tracking-eyebrow text-slate">
            Last day
            <input type="date" name="end" defaultValue={ELECTION_DAY} className="rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink" />
          </label>
          <label className="grid gap-1 text-[0.65rem] uppercase tracking-eyebrow text-slate">
            Early-vote windows (comma-separated)
            <input type="text" name="earlyWindows" defaultValue={DEFAULT_EARLY_WINDOWS.join(", ")} className="w-56 rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink" />
          </label>
          <label className="grid gap-1 text-[0.65rem] uppercase tracking-eyebrow text-slate">
            Election-Day windows
            <input type="text" name="electionDayWindows" defaultValue={DEFAULT_ELECTION_DAY_WINDOWS.join(", ")} className="w-56 rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink" />
          </label>
          <SubmitButton disabled={!connected} pendingText="Generating…" className="btn-primary px-4 py-2 text-sm">
            Generate shifts
          </SubmitButton>
        </div>
        {state.message && (
          <p className={`text-sm ${state.ok ? "text-field" : "text-brick"}`} role="status">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}

const REMIND_IDLE: ShiftRemindersState = { ok: false, message: "" };

function ReminderCard({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState(sendShiftRemindersAction, REMIND_IDLE);
  return (
    <div className="card p-4 no-print">
      <p className="eyebrow text-slate">Remind greeters by text</p>
      <p className="mt-1 max-w-2xl text-sm text-slate">
        One text per greeter covering all their shifts on the chosen date. Only opted-in numbers are texted, and
        sends happen 9am&ndash;8pm CT only (outside that window they&rsquo;re skipped, not queued &mdash; re-run
        later). Captains have no phone on file and are reported as skipped. A &ldquo;&#10003;&rdquo; on a name means
        their reminder for that shift went out.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-[0.65rem] uppercase tracking-eyebrow text-slate">
          Shift date
          <input
            type="date"
            name="date"
            defaultValue={defaultDate}
            className="rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink"
          />
        </label>
        <SubmitButton pendingText="Texting…" className="btn-primary px-4 py-2 text-sm">
          Send reminders
        </SubmitButton>
        {state.message && (
          <p className={`text-sm ${state.ok ? "text-field" : "text-brick"}`} role="status">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}

function ShiftRow({ shift, options }: { shift: ShiftRecord; options: AssigneeOption[] }) {
  const status = shiftStatus(shift);
  const open = options.filter((o) => !shift.assignees.some((a) => a.id === o.id));
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
      <span className="w-24 shrink-0 font-mono text-xs text-ink">{shift.window}</span>
      <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-eyebrow ${STATUS_CLS[status]}`}>
        {status === "covered" ? "covered" : `${shift.assignees.length}/${shift.needed}`}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        {shift.assignees.map((a) => (
          <form
            key={a.id}
            action={assignShift}
            className="inline-flex"
            title={shift.reminded.includes(a.id) ? "Reminder text sent" : undefined}
          >
            <input type="hidden" name="id" value={shift.id} />
            <input type="hidden" name="op" value="remove" />
            <input type="hidden" name="assigneeId" value={a.id} />
            <SubmitButton
              pendingText="…"
              aria-label={`Remove ${a.name} from ${shift.window}`}
              className="rounded-sm bg-paper px-2 py-0.5 text-xs text-ink hover:bg-brick/10"
            >
              {shift.reminded.includes(a.id) ? "✓ " : ""}
              {a.name} ×
            </SubmitButton>
          </form>
        ))}
        {shift.assignees.length < shift.needed && (
          <form action={assignShift} className="inline-flex items-center gap-1">
            <input type="hidden" name="id" value={shift.id} />
            <input type="hidden" name="op" value="add" />
            <select
              name="assignee"
              defaultValue=""
              aria-label={`Assign a greeter to ${shift.site} ${shift.date} ${shift.window}`}
              className="max-w-[12rem] rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink"
            >
              <option value="" disabled>
                — assign —
              </option>
              {open.map((o) => (
                <option key={o.id} value={`${o.id}::${o.name}`}>
                  {o.name}
                  {o.hint ? ` · ${o.hint}` : ""}
                </option>
              ))}
            </select>
            <SubmitButton pendingText="…" className="btn-ghost px-2 py-1 text-xs">Add</SubmitButton>
          </form>
        )}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        <form action={setShiftNeeded} className="flex items-center gap-1">
          <input type="hidden" name="id" value={shift.id} />
          <label className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
            need{" "}
            <select name="needed" defaultValue={String(shift.needed)} className="rounded-sm border border-line bg-white px-1 py-0.5 text-xs text-ink">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <SubmitButton pendingText="…" className="btn-ghost px-1.5 py-0.5 text-xs">Set</SubmitButton>
        </form>
        <form action={setShiftNotes} className="flex items-center gap-1">
          <input type="hidden" name="id" value={shift.id} />
          <input
            type="text"
            name="notes"
            defaultValue={shift.notes ?? ""}
            placeholder="notes"
            aria-label={`Notes for ${shift.site} ${shift.date} ${shift.window}`}
            className="w-32 rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink"
          />
          <SubmitButton pendingText="…" className="btn-ghost px-1.5 py-0.5 text-xs">Save</SubmitButton>
        </form>
        <form
          action={removeShift}
          onSubmit={(e) => {
            if (!window.confirm(`Remove the ${shift.window} shift at ${shift.site} on ${shift.date}?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={shift.id} />
          <SubmitButton pendingText="…" className="font-mono text-[0.7rem] font-bold text-brick hover:underline">
            Remove
          </SubmitButton>
        </form>
      </span>
    </li>
  );
}

export function ShiftBoard({
  initialShifts,
  assigneeOptions,
  prefillSites,
  connected,
}: {
  initialShifts: ShiftRecord[];
  assigneeOptions: AssigneeOption[];
  prefillSites: string;
  connected: boolean;
}) {
  const grid = coverageGrid(initialShifts);
  const stats = fillStats(initialShifts);
  const packets = shiftPackets(initialShifts);
  // Default reminder date: earliest date that still has an un-reminded assignee
  // (derived from data, so server and client agree). Falls back to the first day.
  const defaultRemindDate =
    initialShifts
      .filter((s) => s.assignees.some((a) => !s.reminded.includes(a.id)))
      .map((s) => s.date)
      .sort()[0] ?? EARLY_VOTE_START;
  const anyAssigned = initialShifts.some((s) => s.assignees.length > 0);

  return (
    <div className="grid gap-6">
      <GenerateCard prefillSites={prefillSites} connected={connected} />

      {initialShifts.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Shifts" value={stats.total} />
            <StatChip label="Fill rate" value={`${stats.fillPct}%`} tone={stats.fillPct === 100 ? "field" : undefined} />
            <StatChip label="Partial" value={stats.partial} />
            <StatChip label="Uncovered" value={stats.uncovered} tone={stats.uncovered ? "brick" : "field"} />
          </div>

          <div className="card flex flex-wrap items-center justify-between gap-3 p-4 no-print">
            <p className="text-sm text-slate">
              Packets: one page per assigned greeter (their full schedule + the §7 conduct rules) plus the
              honest unfilled-shifts list — an uncovered site is <strong>uncovered</strong>, never assumed.
            </p>
            <PrintButton className="btn-ghost px-3 py-1.5 text-sm">Print shift packets</PrintButton>
          </div>

          {anyAssigned && <ReminderCard defaultDate={defaultRemindDate} />}

          <div className="grid gap-4">
            {grid.map((site) => {
              const siteShifts = site.days.flatMap((d) => d.shifts);
              const covered = siteShifts.filter((s) => shiftStatus(s) === "covered").length;
              return (
                <details key={site.site} className="card overflow-hidden p-0" open={grid.length <= 3}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
                    <span className="font-display text-lg text-ink">{site.site}</span>
                    {site.county && <span className="font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">{site.county}</span>}
                    <span className={`ml-auto rounded-sm px-2 py-0.5 font-mono text-[0.65rem] font-bold ${covered === siteShifts.length ? "bg-field/10 text-field" : "bg-brick/10 text-brick"}`}>
                      {covered}/{siteShifts.length} covered
                    </span>
                  </summary>
                  <div className="divide-y divide-line border-t border-line">
                    {site.days.map((day) => (
                      <div key={day.date}>
                        <p className="bg-paper px-4 py-1.5 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">
                          {fmtDay(day.date)}
                          {day.date === ELECTION_DAY && <span className="ml-2 font-bold text-brick">Election Day</span>}
                        </p>
                        <ul className="divide-y divide-line/60">
                          {day.shifts.map((s) => (
                            <ShiftRow key={s.id} shift={s} options={assigneeOptions} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <ShiftPacketSheets packets={packets.packets} unfilled={packets.unfilled} />
        </>
      )}
    </div>
  );
}
