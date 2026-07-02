import { extRoute } from "@/lib/http/ext-route";
import { listEvents } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extension: the event calendar (all events incl. drafts). `manageEvents` = admin
// + captain, matching the dashboard events surface.
export const { GET, OPTIONS } = extRoute({
  capability: "manageEvents",
  source: "event calendar",
  load: () => listEvents(),
});
