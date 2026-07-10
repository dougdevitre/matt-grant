import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listShifts } from "@/lib/coverage/shiftStore";
import { myUpcomingShifts, openShifts, shiftStatus, ELECTION_DAY } from "@/lib/coverage/shifts";
import { claimShift, dropShift } from "@/app/(site)/community/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

// "Greet voters at the polls" — volunteer self-signup for the poll-coverage
// shift board (candidate/poll-coverage-plan.md §4–§5). Async server component,
// self-scoped to the signed-in email like MatchedActions: only existing
// volunteers see it, claims/drops run through session-scoped actions, and the
// same board the field director manages updates instantly. Degrades quietly —
// no volunteer profile or no open upcoming shifts → renders nothing.
const MAX_OPEN_SHOWN = 12;

const fmtDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export async function PollShifts({ email }: { email?: string | null }) {
  if (!email) return null;
  const [profile, shifts] = await Promise.all([getMyVolunteerProfile(email), listShifts()]);
  if (!profile) return null; // not a volunteer — the other cards serve them

  const me = `e:${email.trim().toLowerCase()}`;
  const from = today();
  const mine = myUpcomingShifts(shifts, me, from);
  const open = openShifts(shifts, from, me);
  if (mine.length === 0 && open.length === 0) return null;

  return (
    <div className="mt-14">
      <p className="eyebrow text-brick">Field volunteering</p>
      <h2 className="mt-2 text-2xl font-semibold">Greet voters at the polls</h2>
      <p className="mt-1 max-w-prose text-sm text-slate">
        Early voting runs July 21 &ndash; August 3, then Election Day August 4. A greeter is a friendly last
        reminder outside the legal buffer &mdash; stay 25+ feet from the polling-place door, never block or
        follow anyone, and your captain will brief you before your first shift.
      </p>

      {mine.length > 0 && (
        <>
          <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">Your shifts</p>
          <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
            {mine.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-ink">{s.site}</span>
                  <span className="ml-2 font-mono text-[0.65rem] text-slate">
                    {fmtDay(s.date)} · {s.window}
                    {s.date === ELECTION_DAY ? " · Election Day" : ""}
                  </span>
                </span>
                <form action={dropShift}>
                  <input type="hidden" name="shiftId" value={s.id} />
                  <SubmitButton pendingText="…" className="font-mono text-[0.7rem] font-bold text-brick hover:underline">
                    Can&apos;t make it
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      {open.length > 0 && (
        <>
          <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">Open shifts — take one</p>
          <ul className="mt-2 divide-y divide-line rounded-sm border border-line">
            {open.slice(0, MAX_OPEN_SHOWN).map((s) => {
              const left = s.needed - s.assignees.length;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-ink">{s.site}</span>
                    <span className="ml-2 font-mono text-[0.65rem] text-slate">
                      {fmtDay(s.date)} · {s.window}
                      {s.date === ELECTION_DAY ? " · Election Day" : ""}
                      {shiftStatus(s) === "partial" ? ` · ${left} more needed` : ""}
                    </span>
                  </span>
                  <form action={claimShift}>
                    <input type="hidden" name="shiftId" value={s.id} />
                    <SubmitButton pendingText="Signing up…" className="btn-ghost px-3 py-1 text-xs">
                      Take this shift
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
          {open.length > MAX_OPEN_SHOWN && (
            <p className="mt-1.5 text-[0.75rem] text-slate">
              Showing the next {MAX_OPEN_SHOWN} of {open.length} open shifts — take one and more appear.
            </p>
          )}
        </>
      )}
    </div>
  );
}
