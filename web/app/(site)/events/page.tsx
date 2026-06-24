import type { Metadata } from "next";
import Link from "next/link";
import { listUpcomingEvents } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";
import { CAMPAIGN } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events",
  description: `Join ${CAMPAIGN.candidate} at campaign events across Missouri's 2nd District — town halls, rallies, canvasses, and more. RSVP and sign up to help.`,
};

export default async function EventsPage() {
  const events = await listUpcomingEvents({ publishedOnly: true });

  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">Get involved</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Where to find Matt.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Come meet {CAMPAIGN.candidate} across Missouri&apos;s 2nd District. RSVP for an event, add it to your calendar, and
        sign up to help knock doors, make calls, or staff a table.
      </p>

      {events.length === 0 ? (
        <div className="mt-12 rounded-lg border border-line bg-paper p-10 text-center text-slate">
          No events on the calendar right now — check back soon, or{" "}
          <Link href="/act" className="text-field underline">sign up to volunteer</Link> and we&apos;ll invite you to the next one.
        </div>
      ) : (
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {events.map((e) => (
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
    </section>
  );
}
