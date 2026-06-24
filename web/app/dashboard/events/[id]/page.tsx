import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCap } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";
import { districtLabel } from "@/lib/events/districts";
import { getDistrictInsight } from "@/lib/events/insights";
import { SITE_URL } from "@/lib/site";
import { PageHeader } from "@/components/dashboard/Notice";
import { EventComposer } from "@/components/dashboard/EventComposer";
import { DistrictInsightPanel } from "@/components/dashboard/DistrictInsightPanel";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { ConfirmButton } from "@/components/dashboard/ConfirmButton";
import { publishEvent, cancelEvent, unpublishEvent, removeEvent } from "../actions";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("manageEvents");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const insight = await getDistrictInsight(event.districtKey);
  const going = event.signups.reduce((s, x) => s + (Number(x.count) || 1), 0);

  return (
    <>
      <Link href="/dashboard/events" className="text-sm text-field underline">← All events</Link>
      <PageHeader kicker={EVENT_TYPE_LABELS[event.type]} title={event.title}>
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
