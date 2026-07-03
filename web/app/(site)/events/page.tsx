import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { listUpcomingEvents, toPublicEvent } from "@/lib/events";
import { CAMPAIGN } from "@/lib/site";
import { EventsFilter } from "@/components/site/EventsFilter";

// Public, non-personalized list. The type filter runs client-side (EventsFilter),
// so this renders as ISR — CloudFront serves it instead of the SSR Lambda per view.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Events",
  description: `Join ${CAMPAIGN.candidate} at campaign events across Missouri's 2nd District — town halls, rallies, canvasses, and more. RSVP and sign up to help.`,
};

export default async function EventsPage() {
  // Sanitize to the public shape before it crosses to the client filter.
  const events = (await listUpcomingEvents({ publishedOnly: true })).map(toPublicEvent);

  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">Get involved</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Where to find Matt.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Come meet {CAMPAIGN.candidate} across Missouri&apos;s 2nd District. RSVP for an event, add it to your calendar, and
        sign up to help knock doors, make calls, or staff a table.
      </p>

      {events.length > 0 && (
        <a href="/api/events/calendar.ics" className="mt-5 inline-flex items-center gap-2 font-mono text-xs font-bold text-brick hover:underline">
          📅 Subscribe to all events
        </a>
      )}

      <Suspense fallback={<div className="mt-12 text-slate">Loading events…</div>}>
        <EventsFilter events={events} />
      </Suspense>
    </section>
  );
}
