import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { listEvents, listUpcomingEvents, type EventRow } from "@/lib/events";

// GeoJSON of campaign events for the dashboard map's Events layer. Only events
// that resolved to coordinates (geocoded or hand-pinned) are plotted. Event
// managers see drafts too; other staff see published upcoming events only.
export const dynamic = "force-dynamic";

function feature(e: EventRow): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      id: e.id,
      title: e.title,
      type: e.type,
      status: e.status,
      start: e.start,
      allDay: e.allDay,
      locationName: e.location.name || e.location.city || "",
    },
    geometry: { type: "Point", coordinates: [e.lng as number, e.lat as number] },
  };
}

export async function GET() {
  const { allowed } = await checkCap("manageEvents");
  let rows: EventRow[];
  if (allowed) {
    rows = (await listEvents()).rows.filter((e) => e.status !== "CANCELLED");
  } else {
    rows = await listUpcomingEvents({ publishedOnly: true });
  }
  const features = rows.filter((e) => e.lat != null && e.lng != null).map(feature);
  return NextResponse.json(
    { type: "FeatureCollection", features, meta: { count: features.length, includesDrafts: allowed } },
    { headers: { "cache-control": "no-store" } },
  );
}
