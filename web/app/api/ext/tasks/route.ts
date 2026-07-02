import { extRoute } from "@/lib/http/ext-route";
import { getTasks } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extension: the task board. `manageTasks` = all staff tiers.
export const { GET, OPTIONS } = extRoute({
  capability: "manageTasks",
  source: "task board",
  load: () => getTasks(),
});
