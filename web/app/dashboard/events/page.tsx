import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { EVENT_TYPE_LABELS, isEventType, type EventRow } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";
import { districtLabel } from "@/lib/events/districts";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { EventComposer } from "@/components/dashboard/EventComposer";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-field/15 text-field",
  DRAFT: "bg-gold/20 text-ink",
  CANCELLED: "bg-brick/15 text-brick line-through",
};

function EventRowCard({ e }: { e: EventRow }) {
  const going = e.signups.reduce((s, x) => s + (Number(x.count) || 1), 0);
  return (
    <Link
      href={`/dashboard/events/${e.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-line bg-paper px-4 py-3 hover:border-field"
    >
      <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-eyebrow ${STATUS_BADGE[e.status] ?? "bg-line text-slate"}`}>
        {e.status}
      </span>
      <span className="font-semibold text-ink">{e.title}</span>
      <span className="text-xs text-slate">{EVENT_TYPE_LABELS[e.type]}</span>
      <span className="ml-auto font-mono text-xs text-slate">{formatEventRange(e.start, e.end)}</span>
      <span className="w-full text-xs text-slate">
        {[e.location.name, districtLabel(e.districtKey)].filter(Boolean).join(" · ")}
        {e.source === "email" && <span className="ml-2 text-field">· from email</span>}
        {going > 0 && <span className="ml-2">· {going} signed up</span>}
        {e.capacity ? <span className="text-slate"> / {e.capacity}</span> : null}
        {(e.volunteers.length > 0 || e.captain) && (
          <span className="ml-2 text-field">· staffed: {e.captain ? "captain" : "no captain"}, {e.volunteers.length} vol</span>
        )}
      </span>
    </Link>
  );
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireCap("manageEvents");
  const { type } = await searchParams;
  const { connected, rows: allRows } = await listEvents();
  const active = isEventType(type) ? type : null;
  const presentTypes = [...new Set(allRows.map((e) => e.type))];
  const rows = active ? allRows.filter((e) => e.type === active) : allRows;
  const now = new Date().toISOString();
  const upcoming = rows.filter((e) => e.start >= now);
  const past = rows.filter((e) => e.start < now).reverse();

  return (
    <>
      <PageHeader kicker="Field" title="Events">
        <Link href="/dashboard/events/opportunities" className="text-sm text-field underline">Appearance opportunities →</Link>
        {connected && <span className="ml-3 font-mono text-sm text-slate">{rows.length} total</span>}
      </PageHeader>

      {!connected && <DbNotice />}

      <HowTo
        steps={[
          "Add an appearance by hand, or paste a forwarded event email and let AI fill the form.",
          "New events start as a DRAFT. Open one to review the details and the district snapshot.",
          "Publish when ready — that posts it to the public /events page and texts/emails captains & volunteers (texts send 9am–8pm CT).",
          "Volunteers and supporters RSVP from the public page; their sign-ups show on the event’s detail page.",
          "Forwarding to events@mattgrantforcongress.org goes live once inbound email is connected (Phase 2) — until then, use the paste box.",
        ]}
      />

      <div className="mb-8">
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">Add an event</h2>
        <EventComposer />
      </div>

      {presentTypes.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/dashboard/events" className={`rounded-full border px-3 py-1 text-xs ${active ? "border-line text-slate hover:border-ink" : "border-ink bg-ink text-paper"}`}>
            All
          </Link>
          {presentTypes.map((t) => (
            <Link
              key={t}
              href={`/dashboard/events?type=${t}`}
              className={`rounded-full border px-3 py-1 text-xs ${active === t ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
            >
              {EVENT_TYPE_LABELS[t]}
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Upcoming</h2>
      {upcoming.length === 0 ? (
        <p className="mb-8 rounded-sm border border-line bg-paper p-4 text-sm text-slate">No upcoming events yet.</p>
      ) : (
        <div className="mb-8 space-y-2">{upcoming.map((e) => <EventRowCard key={e.id} e={e} />)}</div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">Past</h2>
          <div className="space-y-2 opacity-75">{past.map((e) => <EventRowCard key={e.id} e={e} />)}</div>
        </>
      )}
    </>
  );
}
