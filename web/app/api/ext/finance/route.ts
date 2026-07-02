import { extRoute } from "@/lib/http/ext-route";
import { getFinance } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extension: finance totals + expenditures. `viewFinanceTotals` = admin + captain
// (read-only), matching the dashboard finance surface.
export const { GET, OPTIONS } = extRoute({
  capability: "viewFinanceTotals",
  source: "campaign finance",
  load: () => getFinance(),
});
