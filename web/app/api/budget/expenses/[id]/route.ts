// PATCH /api/budget/expenses/:id — transition a request's status (+ record
// decision/payment). Admin-only (editFinance): proposing stays open to
// finance-visible staff, but approving/paying/rejecting is privileged.
import { checkCap } from "@/lib/auth";
import { apiOk, apiError, apiFail, forbidden } from "@/lib/contracts/api";
import { can as accessAllows } from "@/lib/airtable/access";
import {
  transitionExpense,
  IllegalTransitionError,
  ExpenseNotFoundError,
} from "@/lib/budget/expenses";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/budget/types";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await checkCap("editFinance");
  if (!allowed) return forbidden();
  // Admin-governed CRUD: a transition is an Update on Expense Requests (fail-closed).
  if (!(await accessAllows("budget", "Expense Requests", "dashboard", "update"))) return forbidden();
  const { id } = await params;
  if (!id) return apiError("Missing id", 400);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON", 400);
  }
  const status = String(body.status ?? "");
  if (!(EXPENSE_STATUSES as string[]).includes(status)) return apiError("Unknown status", 400);

  try {
    const expense = await transitionExpense(id, {
      status: status as ExpenseStatus,
      paymentMethod: typeof body.paymentMethod === "string" ? body.paymentMethod : undefined,
      paymentReference: typeof body.paymentReference === "string" ? body.paymentReference : undefined,
      paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return apiOk({ expense });
  } catch (err) {
    if (err instanceof ExpenseNotFoundError) return apiError("Not found", 404);
    if (err instanceof IllegalTransitionError) {
      return apiError("That status change isn't allowed from the current state.", 409);
    }
    return apiFail(err, "Could not update request", 502, "budget/expenses:PATCH");
  }
}
