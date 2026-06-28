// GET /api/budget/summary — derived finance figures from the expense pipeline
// (pending / committed / spent + spend-by-category). Read-only; aggregate numbers
// only, no raw records, no token.
import { checkCap } from "@/lib/auth";
import { apiOk, apiFail, forbidden } from "@/lib/contracts/api";
import { getBudgetSummary } from "@/lib/budget/expenses";

export async function GET() {
  const { allowed } = await checkCap("viewFinanceTotals");
  if (!allowed) return forbidden();
  try {
    return apiOk(await getBudgetSummary());
  } catch (err) {
    return apiFail(err, "Could not load summary", 502, "budget/summary");
  }
}
