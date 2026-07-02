import { extRoute } from "@/lib/http/ext-route";
import { getOverview } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extension: campaign overview (totals, counts, milestones). Same gate as the
// dashboard home — `viewOverview` (all staff tiers).
export const { GET, OPTIONS } = extRoute({
  capability: "viewOverview",
  source: "campaign overview",
  load: () => getOverview(),
});
