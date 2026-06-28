// Shared types + state machine for the Campaign Expense Budget Builder.
//
// Pure module — no server-only imports — so it's safe to import from both the
// client components and the server routes/data layer. Money here is in WHOLE
// DOLLARS (Airtable currency fields return dollars), distinct from the rest of
// the dashboard which stores cents; conversion to cents happens only at the
// finance-page boundary (the "Committed" stat card).

/** Item catalog row, mirroring the Airtable `Items` table. */
export interface Item {
  id: string;
  name: string;
  category: string;
  vendor: string;
  unitPrice: number; // dollars
  unit: string;
  productLink: string;
  sku: string;
  minOrderQty: number;
}

export interface BudgetSummary {
  available: number;
  allocated: number;
  remaining: number;
  pctAllocated: number; // 0..100+
}

/** Map of item id -> quantity to buy (the planning sandbox). */
export type QtyMap = Record<string, number>;

export type ExpenseStatus =
  | "Proposed"
  | "Under Review"
  | "Approved"
  | "Paid"
  | "Rejected"
  | "Archived";

export const EXPENSE_STATUSES: ExpenseStatus[] = [
  "Proposed",
  "Under Review",
  "Approved",
  "Paid",
  "Rejected",
  "Archived",
];

/** Expense-pipeline row, mirroring the Airtable `Expense Requests` table. */
export interface ExpenseRequest {
  id: string;
  title: string;
  submittedBy: string;
  submitterEmail: string;
  itemId: string | null;
  category: string;
  vendor: string;
  quoteLink: string;
  quantity: number;
  unitPrice: number; // dollars
  amount: number; // dollars
  purpose: string;
  neededBy: string | null;
  status: ExpenseStatus;
  reviewedBy: string | null;
  decisionDate: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  notes: string;
}

/**
 * Allowed status transitions — the SINGLE source of truth, enforced server-side
 * and used by the client to render only legal action buttons.
 *
 * NOTE (FINANCE_PAGE_INTEGRATION §0 money-safety correction): `Paid` is TERMINAL.
 * Archiving a paid item would drop it out of Spent and make Cash on hand jump
 * back up, so `Paid → []`. Archived stays reachable only from non-paid states.
 * Rule: Spent = Σ Paid, and a Paid record is the permanent disbursement record.
 */
export const EXPENSE_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  Proposed: ["Under Review", "Approved", "Rejected", "Archived"],
  "Under Review": ["Approved", "Rejected", "Proposed", "Archived"],
  Approved: ["Paid", "Rejected", "Archived"],
  Paid: [], // terminal — permanent record of a disbursement
  Rejected: ["Archived", "Proposed"],
  Archived: [],
};

/** Derived rollup over a set of expense rows. Amounts in dollars. */
export interface ExpenseRollup {
  pending: number; // Proposed + Under Review
  committed: number; // Approved
  spent: number; // Paid
  counts: Record<ExpenseStatus, number>;
}

/** Finance summary the budget endpoints expose (dollars + cents for the card). */
export interface BudgetFinanceSummary {
  pending: number;
  committed: number;
  spent: number;
  committedCents: number;
  pendingCents: number;
  spentCents: number;
  counts: Record<ExpenseStatus, number>;
  byCategory: { category: string; spent: number }[]; // Paid grouped by Category
}
