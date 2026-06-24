import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCap } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { EVENT_TYPE_LABELS, type EventPriority } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";
import { districtLabel } from "@/lib/events/districts";
import { getDistrictInsight } from "@/lib/events/insights";
import { suggestPriority, PRIORITY_LABEL, PRIORITY_BADGE } from "@/lib/events/priority";
import { listStaff } from "@/lib/staff";
import { getVolunteers } from "@/lib/queries";
import { SITE_URL } from "@/lib/site";
import { PageHeader } from "@/components/dashboard/Notice";
import { EventComposer } from "@/components/dashboard/EventComposer";
import { DistrictInsightPanel } from "@/components/dashboard/DistrictInsightPanel";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import {
  publishEvent, cancelEvent, unpublishEvent, removeEvent, setEventCaptain, addEventVolunteer, removeEventVolunteer,
  setEventPriority, toggleChecklistItem, addChecklistItem, removeChecklistItem, assignChecklistItem,
} from "../actions";

const PRIORITIES: EventPriority[] = [1, 2, 3];

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("manageEvents");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const insight = await getDistrictInsight(event.districtKey);
  const going = event.signups.reduce((s, x) => s + (Number(x.count) || 1), 0);

  // Staffing option lists: captains = active admins/captains; volunteers = the
  // contact roster, ACTIVE first. Both reused from existing stores.
  const captainOptions = (await listStaff())
    .filter((s) => s.status === "active" && (s.role === "admin" || s.role === "captain"))
    .map((s) => ({ id: s.email, name: s.name || s.email }));
  const onRoster = new Set(event.volunteers.map((v) => v.id));
  const volunteerOptions = (await getVolunteers()).rows
    .filter((v) => !onRoster.has(v.id))
    .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE"))
    .map((v) => ({ id: v.id, name: v.name }));
  const selectCls = "w-full rounded-sm border border-line bg-white px-2 py-1.5 text-sm text-ink";
  const checkDone = event.checklist.filter((c) => c.done).length;
  const suggestion = suggestPriority({ type: event.type, districtKey: event.districtKey });

  return (
    <>
      <Link href="/dashboard/events" className="text-sm text-field underline">← All events</Link>
      <PageHeader kicker={EVENT_TYPE_LABELS[event.type]} title={event.title}>
        <span className={`rounded-sm px-2 py-1 font-mono text-[0.65rem] uppercase tracking-eyebrow ${PRIORITY_BADGE[event.priority]}`}>P{event.priority}</span>
        <span className="rounded-sm bg-line px-2 py-1 font-mono text-xs uppercase tracking-eyebrow text-slate">{event.status}</span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Status + notification controls */}
          <div className="card flex flex-wrap items-center gap-3 p-4">
            {event.status !== "PUBLISHED" && (
              <form action={publishEvent}>
                <input type="hidden" name="id" value={event.id} />
                <SubmitButton className="btn-primary text-sm" pendingText="Publishing…">Publish &amp; notify</SubmitButton>
              </form>
            )}
            {event.status === "PUBLISHED" && (
              <form action={unpublishEvent}>
                <input type="hidden" name="id" value={event.id} />
                <SubmitButton className="btn-ghost text-sm" pendingText="…">Unpublish</SubmitButton>
              </form>
            )}
            {event.status !== "CANCELLED" && (
              <form action={cancelEvent}>
                <input type="hidden" name="id" value={event.id} />
                <ConfirmButton message="Mark this event cancelled?" className="btn-ghost text-sm text-brick">Cancel event</ConfirmButton>
              </form>
            )}
            <form action={removeEvent} className="ml-auto">
              <input type="hidden" name="id" value={event.id} />
              <ConfirmButton message="Delete this event permanently? This cannot be undone." className="text-xs text-slate underline">Delete</ConfirmButton>
            </form>
            <p className="w-full text-xs text-slate">
              {event.notifiedEmailAt && <>Emailed captains &amp; volunteers. </>}
              {event.notifiedSmsAt && <>Texted volunteers. </>}
              {event.status === "PUBLISHED" && (
                <Link href={`/events/${event.id}`} className="text-field underline">View public page →</Link>
              )}
            </p>
            {event.notifyResult && (() => {
              const r = event.notifyResult;
              // "no recipients"/"already notified" are expected, not failures; a thrown
              // error (any other reason) means the broadcast didn't go out.
              const benign = (reason?: string) => !reason || /already notified|no email recipients|no opted-in/i.test(reason);
              const failed = (ch: { queued: boolean; reason?: string }) => !ch.queued && !benign(ch.reason);
              const anyFail = failed(r.email) || failed(r.sms);
              return (
                <div className={`w-full rounded-sm px-3 py-2 text-xs ${anyFail ? "bg-gold/25 text-ink" : "bg-line/50 text-slate"}`}>
                  <span className="font-semibold">Notifications:</span> Email — {r.email.queued ? "queued ✓" : r.email.reason ?? "not sent"}; SMS — {r.sms.queued ? "queued ✓" : r.sms.reason ?? "not sent"}.
                  {anyFail && <> A channel didn&apos;t send — check Email/SMS configuration on the Setup page.</>}
                </div>
              );
            })()}
          </div>

          {/* Summary */}
          <div className="card p-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-semibold text-slate">When</dt>
              <dd className="text-ink">{formatEventRange(event.start, event.end)}</dd>
              <dt className="font-semibold text-slate">Where</dt>
              <dd className="text-ink">{[event.location.name, event.location.address, event.location.city, event.location.county].filter(Boolean).join(", ") || "—"}</dd>
              <dt className="font-semibold text-slate">District</dt>
              <dd className="text-ink">{districtLabel(event.districtKey)}</dd>
              <dt className="font-semibold text-slate">Priority</dt>
              <dd className="text-ink">
                <span className={`mr-2 rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${PRIORITY_BADGE[event.priority]}`}>
                  {PRIORITY_LABEL[event.priority]}
                </span>
                <span className="text-xs text-slate">
                  {event.priorityManual ? "set by hand" : "auto"} · suggested P{suggestion.tier}: {suggestion.reasons.join(", ")}
                </span>
                <form action={setEventPriority} className="mt-1 flex items-center gap-2">
                  <input type="hidden" name="id" value={event.id} />
                  <select name="priority" defaultValue={String(event.priority)} aria-label="Override priority" className="rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink">
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>P{p} — {PRIORITY_LABEL[p].split("—")[1].trim()}</option>
                    ))}
                  </select>
                  <SubmitButton pendingText="…" className="btn-ghost px-2.5 py-1 text-xs">Set</SubmitButton>
                </form>
              </dd>
              {event.source === "email" && (
                <>
                  <dt className="font-semibold text-slate">Source</dt>
                  <dd className="text-ink">Parsed from email{event.parseConfidence != null ? ` (confidence ${(event.parseConfidence * 100).toFixed(0)}%)` : ""}</dd>
                </>
              )}
              <dt className="font-semibold text-slate">Add to calendar</dt>
              <dd>
                <a href={`${SITE_URL}/api/events/${event.id}/calendar.ics`} className="text-field underline">Download .ics</a>
              </dd>
            </dl>
            {event.description && <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{event.description}</p>}
          </div>

          {/* Edit */}
          <div>
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Edit details</h2>
            <EventComposer initial={event} />
          </div>
        </div>

        <div className="space-y-6">
          <DistrictInsightPanel insight={insight} districtKey={event.districtKey} eventId={event.id} />

          {/* Staffing — internal captain + volunteer roster (distinct from RSVPs) */}
          <div className="card p-5">
            <h3 className="font-display text-lg font-semibold text-ink">
              Staffing <span className="text-sm font-normal text-slate">({event.volunteers.length} volunteer{event.volunteers.length === 1 ? "" : "s"}{event.captain ? " · captain set" : ""})</span>
            </h3>

            {/* Captain */}
            <form action={setEventCaptain} className="mt-3">
              <label htmlFor="ev-captain" className="block text-xs font-semibold text-slate">Team captain</label>
              <input type="hidden" name="id" value={event.id} />
              <div className="mt-1 flex items-center gap-2">
                <select id="ev-captain" name="captain" defaultValue={event.captain ? `${event.captain.id}|${event.captain.name}` : ""} className={selectCls}>
                  <option value="">— Unassigned —</option>
                  {event.captain && !captainOptions.some((c) => c.id === event.captain!.id) && (
                    <option value={`${event.captain.id}|${event.captain.name}`}>{event.captain.name}</option>
                  )}
                  {captainOptions.map((c) => (
                    <option key={c.id} value={`${c.id}|${c.name}`}>{c.name}</option>
                  ))}
                </select>
                <SubmitButton pendingText="…" className="btn-ghost px-3 py-1.5 text-sm">Set</SubmitButton>
              </div>
            </form>

            {/* Volunteer roster */}
            <p className="mt-4 block text-xs font-semibold text-slate">Volunteers working this event</p>
            {event.volunteers.length === 0 ? (
              <p className="mt-1 text-sm text-slate">None assigned yet.</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {event.volunteers.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="text-ink">{v.name}</span>
                    <form action={removeEventVolunteer}>
                      <input type="hidden" name="id" value={event.id} />
                      <input type="hidden" name="volunteerId" value={v.id} />
                      <SubmitButton pendingText="…" className="text-xs text-brick hover:underline">Remove</SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addEventVolunteer} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="id" value={event.id} />
              <select name="volunteer" aria-label="Add a volunteer to this event" defaultValue="" className={selectCls}>
                <option value="" disabled>Add a volunteer…</option>
                {volunteerOptions.map((v) => (
                  <option key={v.id} value={`${v.id}|${v.name}`}>{v.name}</option>
                ))}
              </select>
              <SubmitButton pendingText="…" className="btn-ghost px-3 py-1.5 text-sm">Add</SubmitButton>
            </form>
            <p className="mt-3 text-[0.7rem] text-slate">Captains are active admins/captains; volunteers come from your contact roster. Publishing still notifies all captains &amp; volunteers.</p>
          </div>

          {/* Captain checklist — run-of-show the captain works with volunteers */}
          <div className="card p-5">
            <h3 className="font-display text-lg font-semibold text-ink">
              Checklist <span className="text-sm font-normal text-slate">({checkDone}/{event.checklist.length})</span>
            </h3>
            {event.checklist.length > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="h-full bg-field" style={{ width: `${Math.round((checkDone / event.checklist.length) * 100)}%` }} />
              </div>
            )}
            {event.checklist.length === 0 ? (
              <p className="mt-2 text-sm text-slate">No checklist items.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {event.checklist.map((item) => (
                  <li key={item.id} className="border-b border-line/60 pb-2">
                    <div className="flex items-start gap-2">
                      <form action={toggleChecklistItem} className="mt-0.5">
                        <input type="hidden" name="id" value={event.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <SubmitButton
                          pendingText="…"
                          aria-label={item.done ? "Mark not done" : "Mark done"}
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.7rem] ${item.done ? "bg-field text-paper" : "border-2 border-line text-transparent"}`}
                        >
                          ✓
                        </SubmitButton>
                      </form>
                      <span className={`flex-1 text-sm ${item.done ? "text-slate line-through" : "text-ink"}`}>{item.text}</span>
                      <form action={removeChecklistItem}>
                        <input type="hidden" name="id" value={event.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <SubmitButton pendingText="…" className="text-xs text-brick hover:underline">Remove</SubmitButton>
                      </form>
                    </div>
                    <div className="ml-7 mt-1 flex flex-wrap items-center gap-2">
                      <form action={assignChecklistItem} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={event.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <select name="assignee" defaultValue={item.assigneeId ? `${item.assigneeId}|${item.assigneeName ?? ""}` : ""} aria-label={`Assign "${item.text}"`} className="rounded-sm border border-line bg-white px-1.5 py-1 text-xs text-ink">
                          <option value="">— Owner —</option>
                          {item.assigneeId && !event.volunteers.some((v) => v.id === item.assigneeId) && (
                            <option value={`${item.assigneeId}|${item.assigneeName ?? ""}`}>{item.assigneeName}</option>
                          )}
                          {event.volunteers.map((v) => (
                            <option key={v.id} value={`${v.id}|${v.name}`}>{v.name}</option>
                          ))}
                        </select>
                        <SubmitButton pendingText="…" className="text-xs text-field hover:underline">Set</SubmitButton>
                      </form>
                      {item.done && item.doneBy && <span className="text-[0.65rem] text-slate">✓ by {item.doneBy}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form action={addChecklistItem} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="id" value={event.id} />
              <input name="text" maxLength={200} placeholder="Add a checklist item…" className={selectCls} />
              <SubmitButton pendingText="…" className="btn-ghost px-3 py-1.5 text-sm">Add</SubmitButton>
            </form>
            <p className="mt-3 text-[0.7rem] text-slate">Seeded from the event type. Assign items to a roster volunteer; the captain checks them off day-of.</p>
          </div>

          {/* Sign-ups (staff-only PII) */}
          <div className="card p-5">
            <h3 className="font-display text-lg font-semibold text-ink">
              Sign-ups <span className="text-sm font-normal text-slate">({going}{event.capacity ? ` / ${event.capacity}` : ""})</span>
            </h3>
            {event.signups.length === 0 ? (
              <p className="mt-2 text-sm text-slate">No RSVPs yet. They arrive from the public event page.</p>
            ) : (
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                    <th className="py-1">Name</th>
                    <th className="py-1">Contact</th>
                    <th className="py-1">Role</th>
                    <th className="py-1 text-right">#</th>
                  </tr>
                </thead>
                <tbody>
                  {event.signups.map((s) => (
                    <tr key={s.id} className="border-b border-line/60">
                      <td className="py-1.5 text-ink">{s.name}</td>
                      <td className="py-1.5 text-slate">{s.email || s.phone || "—"}</td>
                      <td className="py-1.5 text-slate">{s.role || "—"}</td>
                      <td className="py-1.5 text-right text-ink">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[0.7rem] text-slate">Contact details are staff-only — the public page shows just a count.</p>
          </div>
        </div>
      </div>
    </>
  );
}
