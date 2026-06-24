import { getEvent } from "@/lib/events";
import { eventToIcs } from "@/lib/events/ics";

// Add-to-calendar download for a single event. Served at
// /api/events/<id>/calendar.ics so Apple/Google/Outlook accept it directly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event || event.status === "CANCELLED") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(eventToIcs(event), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="event-${id}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
}
