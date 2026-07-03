"use client";

// Client-side type filter for the public events list. Lets the page render
// statically (ISR) instead of force-dynamic: the full published list is passed in
// once, and the `?type=` filter is applied in the browser via useSearchParams —
// the pills still update the URL so filtered links remain shareable.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EVENT_TYPE_LABELS, isEventType, type PublicEvent } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";

export function EventsFilter({ events }: { events: PublicEvent[] }) {
  const typeParam = useSearchParams().get("type");
  const active = isEventType(typeParam) ? typeParam : null;
  const shown = active ? events.filter((e) => e.type === active) : events;
  // Only offer filters for types that actually have upcoming events.
  const presentTypes = [...new Set(events.map((e) => e.type))];

  return (
    <>
      {presentTypes.length > 1 && (
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/events" className={`rounded-full border px-3 py-1 text-sm ${active ? "border-line text-slate hover:border-ink" : "border-ink bg-ink text-paper"}`}>
            All
          </Link>
          {presentTypes.map((t) => (
            <Link
              key={t}
              href={`/events?type=${t}`}
              className={`rounded-full border px-3 py-1 text-sm ${active === t ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`}
            >
              {EVENT_TYPE_LABELS[t]}
            </Link>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mt-12 rounded-lg border border-line bg-paper p-10 text-center text-slate">
          No events on the calendar right now — check back soon, or{" "}
          <Link href="/act" className="text-field underline">sign up to volunteer</Link> and we&apos;ll invite you to the next one.
        </div>
      ) : (
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {shown.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group card flex flex-col p-6 transition duration-200 hover:-translate-y-1 hover:border-ink hover:shadow-lg motion-reduce:hover:translate-y-0"
            >
              <p className="font-mono text-xs uppercase tracking-eyebrow text-gold">{EVENT_TYPE_LABELS[e.type]}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-ink group-hover:text-brick">{e.title}</h2>
              <p className="mt-2 font-mono text-sm text-slate">{formatEventRange(e.start, e.end)}</p>
              <p className="mt-1 text-slate">{[e.location.name, e.location.city].filter(Boolean).join(", ")}</p>
              <span className="mt-4 inline-block font-mono text-xs font-bold text-brick">RSVP &amp; details →</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
