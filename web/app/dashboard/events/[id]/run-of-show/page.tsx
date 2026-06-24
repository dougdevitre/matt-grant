import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCap } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";
import { districtLabel } from "@/lib/events/districts";
import { suggestPriority, PRIORITY_LABEL, PRIORITY_BADGE } from "@/lib/events/priority";
import { PrintButton } from "@/components/dashboard/PrintButton";

// Captain field kit: a print-first / mobile run-of-show sheet a captain takes to
// the event. Bundles when/where, priority + rationale, the roster with each
// person's assigned jobs, and the full checklist. The page's `.printable` wrapper
// (with globals.css `@media print`) prints just this sheet — no dashboard chrome.
export const dynamic = "force-dynamic";

export default async function RunOfShowPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("manageEvents");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event || event.status === "CANCELLED") notFound();

  const suggestion = suggestPriority({ type: event.type, districtKey: event.districtKey });
  const where = [event.location.name, event.location.address, event.location.city, event.location.county]
    .filter(Boolean)
    .join(", ");
  const checkDone = event.checklist.filter((c) => c.done).length;
  // Group checklist items by the roster volunteer they're assigned to, so each
  // person can see their jobs at a glance; unassigned items stay with the captain.
  const itemsFor = (vId: string) => event.checklist.filter((c) => c.assigneeId === vId);
  const unassigned = event.checklist.filter((c) => !c.assigneeId);

  return (
    <>
      {/* Toolbar — stripped on print */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <Link href={`/dashboard/events/${event.id}`} className="text-sm text-field underline">← Back to event</Link>
        <PrintButton className="btn-primary text-sm">Print this sheet</PrintButton>
        <span className="text-xs text-slate">Tip: also readable on a phone in the field.</span>
      </div>

      <article className="printable mx-auto max-w-3xl space-y-6 text-ink">
        {/* Header */}
        <header className="border-b border-line pb-4">
          <p className="font-mono text-xs uppercase tracking-eyebrow text-slate">Run of show · {EVENT_TYPE_LABELS[event.type]}</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{event.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-eyebrow ${PRIORITY_BADGE[event.priority]}`}>
              {PRIORITY_LABEL[event.priority]}
            </span>
            <span className="text-slate">{suggestion.reasons.join(" · ")}</span>
          </div>
        </header>

        {/* When / where / who */}
        <section>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-semibold text-slate">When</dt>
            <dd>{formatEventRange(event.start, event.end)}</dd>
            <dt className="font-semibold text-slate">Where</dt>
            <dd>{where || "—"}</dd>
            <dt className="font-semibold text-slate">District</dt>
            <dd>{districtLabel(event.districtKey)}</dd>
            <dt className="font-semibold text-slate">Captain</dt>
            <dd>{event.captain ? event.captain.name : "— unassigned —"}</dd>
          </dl>
        </section>

        {/* Roster with each person's jobs */}
        {event.volunteers.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Team &amp; assignments</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {event.volunteers.map((v) => {
                const jobs = itemsFor(v.id);
                return (
                  <li key={v.id} className="border-b border-line/60 pb-2">
                    <span className="font-semibold text-ink">{v.name}</span>
                    {jobs.length === 0 ? (
                      <span className="text-slate"> — no items assigned</span>
                    ) : (
                      <ul className="ml-4 mt-1 list-disc text-slate">
                        {jobs.map((j) => (
                          <li key={j.id} className={j.done ? "line-through" : ""}>{j.text}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Full checklist */}
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">
            Checklist <span className="text-sm font-normal text-slate">({checkDone}/{event.checklist.length} done)</span>
          </h2>
          {event.checklist.length === 0 ? (
            <p className="mt-2 text-sm text-slate">No checklist items.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {event.checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span aria-hidden className="font-mono text-base leading-5">{item.done ? "☑" : "☐"}</span>
                  <span className="flex-1">
                    <span className={item.done ? "text-slate line-through" : "text-ink"}>{item.text}</span>
                    {item.assigneeName && <span className="text-slate"> — {item.assigneeName}</span>}
                    {item.done && item.doneBy && <span className="text-[0.7rem] text-slate"> · ✓ {item.doneBy}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {event.volunteers.length > 0 && unassigned.length > 0 && (
            <p className="mt-2 text-[0.7rem] text-slate">{unassigned.length} item{unassigned.length === 1 ? "" : "s"} unassigned — captain owns these.</p>
          )}
        </section>

        {/* Details / talking points */}
        {event.description && (
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Details &amp; talking points</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{event.description}</p>
          </section>
        )}

        {/* Blank field notes */}
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Notes / debrief</h2>
          <div className="mt-2 h-32 rounded-sm border border-dashed border-line" aria-hidden />
        </section>
      </article>
    </>
  );
}
