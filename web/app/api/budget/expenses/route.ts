// /api/budget/expenses
//   GET  — list (optionally ?status=) — finance-visible staff
//   POST — propose a new request (always created "Proposed") — finance-visible staff
import { checkCap } from "@/lib/auth";
import { apiOk, apiError, apiFail, forbidden } from "@/lib/contracts/api";
import { can as accessAllows } from "@/lib/airtable/access";
import { listExpenses, proposeExpense } from "@/lib/budget/expenses";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/budget/types";

const EXPENSES_TABLE = "Expense Requests";

export async function GET(req: Request) {
  const { allowed } = await checkCap("viewFinanceTotals");
  if (!allowed) return forbidden();
  try {
    const raw = new URL(req.url).searchParams.get("status");
    const status = raw && (EXPENSE_STATUSES as string[]).includes(raw) ? (raw as ExpenseStatus) : undefined;
    return apiOk({ expenses: await listExpenses(status) });
  } catch (err) {
    return apiFail(err, "Could not load expenses", 502, "budget/expenses:GET");
  }
}

export async function POST(req: Request) {
  const { allowed, gate } = await checkCap("viewFinanceTotals");
  if (!allowed) return forbidden();
  // Admin-governed CRUD: proposing is a Create on Expense Requests (fail-closed).
  if (!(await accessAllows("budget", EXPENSES_TABLE, "dashboard", "create"))) return forbidden();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const vendor = String(body.vendor ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!vendor && !title) return apiError("Add a title or vendor.", 400);
  try {
    const expense = await proposeExpense({
      title: title || undefined,
      // Identity comes from the session, not the client.
      submittedBy: gate.email ?? "Staff",
      submitterEmail: gate.email ?? undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      vendor,
      quoteLink: typeof body.quoteLink === "string" ? body.quoteLink : undefined,
      quantity: Number(body.quantity ?? 0),
      unitPrice: Number(body.unitPrice ?? 0),
      amount: Number(body.amount ?? 0),
      purpose: typeof body.purpose === "string" ? body.purpose : undefined,
      neededBy: typeof body.neededBy === "string" && body.neededBy ? body.neededBy : null,
    });
    return apiOk({ expense }, { status: 201 });
  } catch (err) {
    return apiFail(err, "Could not submit request", 502, "budget/expenses:POST");
  }
}
