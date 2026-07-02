import { NextResponse } from "next/server";
import { z } from "zod";
import { extRoute } from "@/lib/http/ext-route";
import { withCors } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { can as accessAllows } from "@/lib/airtable/access";
import { listExpenses, proposeExpense } from "@/lib/budget/expenses";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPENSES_TABLE = "Expense Requests";
const meta: Provenance = { source: "budget expenses", kind: "api", live: true };

// Read (list) + OPTIONS — finance-visible staff. Mirrors /api/budget/expenses GET.
export const { GET, OPTIONS } = extRoute({
  capability: "viewFinanceTotals",
  source: "budget expenses",
  load: () => listExpenses(),
});

// A request is always created "Proposed" server-side; amount is recomputed from
// qty×unit in the lib, so the client can't set either.
const ProposeSchema = z.object({
  title: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  vendor: z.string().trim().max(200).optional(),
  quoteLink: z.string().trim().max(2000).optional(),
  quantity: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  amount: z.number().nonnegative().optional(),
  purpose: z.string().trim().max(2000).optional(),
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((b) => !!(b.vendor || b.title), { message: "Add a title or vendor." });

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

// POST — propose a new expense request. viewFinanceTotals + the Airtable control
// table's create toggle (same two-gate as the dashboard route).
export async function POST(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("viewFinanceTotals");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  if (!(await accessAllows("budget", EXPENSES_TABLE, "dashboard", "create"))) {
    return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  }
  const parsed = ProposeSchema.safeParse(await readJson(req));
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid expense", meta), { status: 400 }), req);
  try {
    const expense = await proposeExpense({
      ...parsed.data,
      // Identity comes from the session, never the client.
      submittedBy: gate.email ?? "Staff",
      submitterEmail: gate.email ?? undefined,
      neededBy: parsed.data.neededBy ?? null,
    });
    await recordExtAction({ at: new Date().toISOString(), actor: gate.email ?? "unknown", action: "expense.create", target: expense.id });
    return withCors(NextResponse.json(ok({ expense }, { ...meta, count: 1 })), req);
  } catch {
    return withCors(NextResponse.json(fail("could not submit request", meta), { status: 502 }), req);
  }
}
