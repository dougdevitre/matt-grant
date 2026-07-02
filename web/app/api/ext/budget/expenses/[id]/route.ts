import { NextResponse } from "next/server";
import { z } from "zod";
import { withCors, preflight } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { can as accessAllows } from "@/lib/airtable/access";
import { transitionExpense, IllegalTransitionError, ExpenseNotFoundError } from "@/lib/budget/expenses";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "budget expense", kind: "api", live: true };

export function OPTIONS(req: Request): Response {
  return preflight(req);
}

// Transition an existing request's status (+ optional payment detail). Privileged:
// editFinance + the Airtable update toggle — approving/paying/rejecting, not proposing.
// The lib re-validates against the state machine; an illegal jump → 409, missing → 404.
const TransitionSchema = z.object({
  status: z.enum(["Proposed", "Under Review", "Approved", "Paid", "Rejected", "Archived"]),
  paymentMethod: z.string().trim().max(200).optional(),
  paymentReference: z.string().trim().max(200).optional(),
  paymentDate: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { allowed, gate } = await checkCap("editFinance");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  if (!(await accessAllows("budget", "Expense Requests", "dashboard", "update"))) {
    return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  }
  const { id } = await params;
  if (!id) return withCors(NextResponse.json(fail("missing id", meta), { status: 400 }), req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const parsed = TransitionSchema.safeParse(body);
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid transition", meta), { status: 400 }), req);
  try {
    const expense = await transitionExpense(id, parsed.data);
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "expense.transition", target: id });
    return withCors(NextResponse.json(ok({ expense }, meta)), req);
  } catch (err) {
    if (err instanceof ExpenseNotFoundError) return withCors(NextResponse.json(fail("not found", meta), { status: 404 }), req);
    if (err instanceof IllegalTransitionError) {
      return withCors(NextResponse.json(fail("that status change isn't allowed from the current state", meta), { status: 409 }), req);
    }
    return withCors(NextResponse.json(fail("could not update request", meta), { status: 502 }), req);
  }
}
