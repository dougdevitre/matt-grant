// GET /api/budget/items — budget builder catalog (read-only).
// Authenticated staff with finance visibility only; the Airtable token stays
// server-side and never appears in the response.
import { checkCap } from "@/lib/auth";
import { apiOk, apiFail, forbidden } from "@/lib/contracts/api";
import { getBudgetItems } from "@/lib/budget/items";

export async function GET() {
  const { allowed } = await checkCap("viewFinanceTotals");
  if (!allowed) return forbidden();
  try {
    const { items, live } = await getBudgetItems();
    return apiOk({ items, live });
  } catch (err) {
    return apiFail(err, "Could not load catalog", 502, "budget/items");
  }
}
