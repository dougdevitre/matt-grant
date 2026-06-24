import { listUpcomingEvents } from "@/lib/events";
import { eventsToIcsFeed } from "@/lib/events/ics";

// Subscribable calendar feed of all upcoming PUBLISHED events. Point Apple/Google/
// Outlook "subscribe to calendar" at /api/events/calendar.ics (or the webcal:// form)
// and new events appear automatically. A short cache keeps it cheap.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = await listUpcomingEvents({ publishedOnly: true });
  return new Response(eventsToIcsFeed(events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="matt-grant-events.ics"',
      "cache-control": "public, max-age=900",
    },
  });
}
