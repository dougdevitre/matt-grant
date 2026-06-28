// Server-only data access for the Expense Requests approval pipeline.
//
// The status state machine (EXPENSE_TRANSITIONS) is the source of truth and is
// re-checked HERE on every transition — never trust a client-supplied status.
// Authorization (who may propose vs. transition) is enforced one layer up in the
// route handlers via the dashboard RBAC (viewFinanceTotals / editFinance).
import "server-only";
import {
  listRecords,
  getRecord,
  createRecords,
  updateRecords,
  type AirtableRecord,
} from "@/lib/airtable/client";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import type { BudgetFinanceSummary, ExpenseRequest, ExpenseStatus } from "./types";
import { EXPENSE_TRANSITIONS } from "./types";
import { isValidHttpUrl, paidByCategory, rollupExpenses } from "./plan";

const BASE = AIRTABLE_BASES.budget.id;
const TABLE = AIRTABLE_BASES.budget.tables.expenseRequests;

const dollarsToCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
const today = () => new Date().toISOString().slice(0, 10);

function mapRow(r: AirtableRecord): ExpenseRequest {
  const f = r.fields as Record<string, unknown>;
  const itemLink = Array.isArray(f["Item"]) ? (f["Item"] as string[])[0] : null;
  const reviewer = f["Reviewed By"] as { name?: string } | undefined;
  const statusRaw = String(f["Status"] ?? "Proposed");
  const status = (EXPENSE_TRANSITIONS as Record<string, unknown>)[statusRaw]
    ? (statusRaw as ExpenseStatus)
    : "Proposed";
  return {
    id: r.id,
    title: String(f["Request Title"] ?? ""),
    submittedBy: String(f["Submitted By"] ?? ""),
    submitterEmail: String(f["Submitter Email"] ?? ""),
    itemId: itemLink ?? null,
    category: String(f["Category"] ?? ""),
    vendor: String(f["Vendor"] ?? ""),
    quoteLink: String(f["Quote / Product Link"] ?? ""),
    quantity: Number(f["Quantity"] ?? 0),
    unitPrice: Number(f["Unit Price"] ?? 0),
    amount: Number(f["Amount"] ?? 0),
    purpose: String(f["Purpose / Justification"] ?? ""),
    neededBy: (f["Needed By"] as string) ?? null,
    status,
    reviewedBy: reviewer?.name ?? null,
    decisionDate: (f["Decision Date"] as string) ?? null,
    paymentMethod: (f["Payment Method"] as string) ?? null,
    paymentReference: (f["Payment Reference"] as string) ?? null,
    paymentDate: (f["Payment Date"] as string) ?? null,
    notes: String(f["Notes"] ?? ""),
  };
}

/** List expense requests, optionally filtered to one status. */
export async function listExpenses(status?: ExpenseStatus): Promise<ExpenseRequest[]> {
  const records = await listRecords(BASE, TABLE, {
    filterByFormula: status ? `{Status}='${status}'` : undefined,
    pageSize: 100,
  });
  return records.map(mapRow);
}

export type ProposeInput = {
  title?: string;
  submittedBy: string;
  submitterEmail?: string;
  category?: string;
  vendor?: string;
  quoteLink?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  purpose?: string;
  neededBy?: string | null;
};

/** Create a request. Status is ALWAYS forced to "Proposed". Amount recomputed
 *  from qty × unit when both are present (clients can't inflate past line math). */
export async function proposeExpense(input: ProposeInput): Promise<ExpenseRequest> {
  const qty = Number(input.quantity ?? 0);
  const unit = Number(input.unitPrice ?? 0);
  const amount = qty > 0 && unit > 0 ? qty * unit : Number(input.amount ?? 0);
  const fields: Record<string, unknown> = {
    "Request Title": String(input.title ?? input.vendor ?? "Expense request").slice(0, 200),
    "Submitted By": input.submittedBy,
    "Submitter Email": String(input.submitterEmail ?? ""),
    Category: input.category ?? "Other",
    Vendor: String(input.vendor ?? ""),
    "Quote / Product Link": isValidHttpUrl(String(input.quoteLink ?? "")) ? String(input.quoteLink) : "",
    Quantity: qty,
    "Unit Price": unit,
    Amount: amount,
    "Purpose / Justification": String(input.purpose ?? ""),
    Status: "Proposed", // always forced
  };
  if (input.neededBy) fields["Needed By"] = input.neededBy;
  const [created] = await createRecords(BASE, TABLE, [{ fields }]);
  return mapRow(created);
}

export type TransitionInput = {
  status: ExpenseStatus;
  paymentMethod?: string;
  paymentReference?: string;
  paymentDate?: string;
  notes?: string;
};

export class IllegalTransitionError extends Error {
  constructor(readonly from: string, readonly to: string) {
    super(`illegal transition ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}
export class ExpenseNotFoundError extends Error {
  constructor() {
    super("expense not found");
    this.name = "ExpenseNotFoundError";
  }
}

/** Transition a request's status, validating against the state machine and
 *  stamping decision/payment fields. Throws on illegal transition / not found. */
export async function transitionExpense(id: string, input: TransitionInput): Promise<ExpenseRequest> {
  const current = await getRecord(BASE, TABLE, id);
  if (!current) throw new ExpenseNotFoundError();
  const from = String(current.fields["Status"] ?? "Proposed") as ExpenseStatus;
  const to = input.status;
  if (!EXPENSE_TRANSITIONS[from]?.includes(to)) throw new IllegalTransitionError(from, to);

  const fields: Record<string, unknown> = {
    Status: to,
    "Decision Date": today(),
  };
  if (to === "Paid") {
    fields["Payment Method"] = input.paymentMethod ?? "Other";
    fields["Payment Reference"] = input.paymentReference ?? "";
    fields["Payment Date"] = input.paymentDate ?? today();
  }
  if (input.notes) fields["Notes"] = input.notes;
  const [updated] = await updateRecords(BASE, TABLE, [{ id, fields }]);
  return mapRow(updated);
}

/** Aggregate finance figures derived from the expense pipeline (Airtable). */
export async function getBudgetSummary(): Promise<BudgetFinanceSummary> {
  const rows = await listExpenses();
  const roll = rollupExpenses(rows);
  return {
    pending: roll.pending,
    committed: roll.committed,
    spent: roll.spent,
    pendingCents: dollarsToCents(roll.pending),
    committedCents: dollarsToCents(roll.committed),
    spentCents: dollarsToCents(roll.spent),
    counts: roll.counts,
    byCategory: paidByCategory(rows),
  };
}
