# BUDGET_BUILDER_EXPENSES.md

Extension to `BUDGET_BUILDER_BUILD.md` — adds an **expense approval pipeline** to the
`budget-builder` feature: anyone proposes an expense, an admin reviews, accepts it into the
budget, records payment to the vendor, then archives it.

> **For the building agent:** this builds *on top of* the files in `BUDGET_BUILDER_BUILD.md`.
> Reuse `config.ts`, `money.ts`, and the SSM token helper. Do not duplicate the token logic.
> The status state machine is enforced **server-side** — never trust a client-supplied status.
> Approving and paying are **admin-only** (Clerk role). A proposer must not be able to
> approve their own request.

---

## 1. What this adds

```
Propose ──► Under Review ──► Approved ──► Paid ──► Archived
   │             │              │
   └─────────────┴──────────────┴──► Rejected ──► Archived
   (anyone)            (admin only)
```

- **Proposed / Under Review** — pending, does *not* reduce remaining funds.
- **Approved** — committed; reduces remaining (accepted into the budget).
- **Paid** — spent; reduces remaining. Vendor + Amount + Purpose + Payment Date = FEC-style record.
- **Rejected / Archived** — excluded from remaining.

Airtable table already created: **Expense Requests** (`tblpXHQerkk8OYqt3`) in base `appiuSYCexFUmGIOr`.

## 2. Goals / Non-goals (delta)

- **Goal:** capture, review, and disposition expenses without anyone editing Airtable directly.
- **Goal:** keep the budget ledger honest — committed + spent come from real, admin-approved records.
- **Non-goal:** moving money. "Paid" *records* a payment the treasurer made elsewhere; the tool does not transfer funds.
- **Non-goal:** replacing the filed FEC ledger. This captures the same fields to make filing easier.

## 3. Data model — `ExpenseRequest`

Mirrors the `Expense Requests` table.

| Field | Type | Airtable field |
|---|---|---|
| id | string | record id |
| title | string | Request Title |
| submittedBy | string | Submitted By |
| submitterEmail | string | Submitter Email |
| itemId | string \| null | Item (first linked) |
| category | string | Category |
| vendor | string | Vendor |
| quoteLink | string | Quote / Product Link |
| quantity | number | Quantity |
| unitPrice | number | Unit Price |
| amount | number | Amount |
| purpose | string | Purpose / Justification |
| neededBy | string \| null | Needed By (ISO date) |
| status | ExpenseStatus | Status |
| reviewedBy | string \| null | Reviewed By |
| decisionDate | string \| null | Decision Date |
| paymentMethod | string \| null | Payment Method |
| paymentReference | string \| null | Payment Reference |
| paymentDate | string \| null | Payment Date |
| notes | string | Notes |

## 4. State machine (enforced server-side)

```
Proposed     → Under Review | Approved | Rejected | Archived
Under Review → Approved | Rejected | Proposed | Archived
Approved     → Paid | Rejected | Archived
Paid         → Archived
Rejected     → Archived | Proposed     (reopen)
Archived     → (terminal)
```

Budget impact:

```
pending   = Σ amount where status ∈ {Proposed, Under Review}
committed = Σ amount where status = Approved
spent     = Σ amount where status = Paid
remaining = available − committed − spent
```

## 5. API routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/budget/expenses` | authenticated | List (optionally `?status=`) |
| POST | `/api/budget/expenses` | authenticated | Create a **Proposed** request |
| PATCH | `/api/budget/expenses/:id` | **admin** | Transition status + record decision/payment |

- POST always forces `status = "Proposed"` regardless of input.
- PATCH validates the transition against the state machine and stamps `Reviewed By` / dates.
- Both write to Airtable server-side; the PAT now needs **`data.records:write`** scope.

## 6. Security

- **Clerk** gates all writes. PATCH additionally requires an admin/treasurer role — reuse the repo's existing role check (same one the captain toolkit compliance routes use).
- Illegal transitions return `409`; non-admins on PATCH return `403`.
- Server recomputes `amount` from `quantity × unitPrice` when both are present, so a client can't inflate a request past its line math (flat amounts allowed only when no qty/unit given).
- Link fields scheme-validated (`http`/`https`).
- IAM unchanged — still only `ssm:GetParameter` on the one PAT param.

## 7. Files

### `src/features/budget-builder/types.ts` (append)

```ts
export type ExpenseStatus =
  | "Proposed" | "Under Review" | "Approved" | "Paid" | "Rejected" | "Archived";

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
  unitPrice: number;
  amount: number;
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

export interface ExpenseRollup {
  pending: number;
  committed: number; // Approved
  spent: number;     // Paid
}

/** Allowed status transitions. Mirrored on the server (source of truth). */
export const EXPENSE_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  "Proposed": ["Under Review", "Approved", "Rejected", "Archived"],
  "Under Review": ["Approved", "Rejected", "Proposed", "Archived"],
  "Approved": ["Paid", "Rejected", "Archived"],
  "Paid": ["Archived"],
  "Rejected": ["Archived", "Proposed"],
  "Archived": [],
};
```

### `src/features/budget-builder/money.ts` (append)

```ts
import type { ExpenseRequest, ExpenseRollup } from "./types";

export const rollupExpenses = (rows: ExpenseRequest[]): ExpenseRollup => ({
  pending: sumWhere(rows, ["Proposed", "Under Review"]),
  committed: sumWhere(rows, ["Approved"]),
  spent: sumWhere(rows, ["Paid"]),
});

function sumWhere(rows: ExpenseRequest[], statuses: string[]): number {
  return rows.reduce((s, r) => (statuses.includes(r.status) ? s + (r.amount || 0) : s), 0);
}
```

### `src/features/budget-builder/expensesApi.ts`

```ts
import type { ExpenseRequest, ExpenseStatus } from "./types";

export async function listExpenses(status?: ExpenseStatus): Promise<ExpenseRequest[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`/api/budget/expenses${qs}`);
  if (!res.ok) throw new Error(`expenses ${res.status}`);
  return (await res.json()).expenses as ExpenseRequest[];
}

export type ProposeInput = {
  title: string; submittedBy: string; submitterEmail: string;
  itemId?: string | null; category: string; vendor: string; quoteLink?: string;
  quantity?: number; unitPrice?: number; amount?: number;
  purpose: string; neededBy?: string | null;
};

export async function proposeExpense(input: ProposeInput): Promise<ExpenseRequest> {
  const res = await fetch("/api/budget/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`propose ${res.status}`);
  return (await res.json()).expense as ExpenseRequest;
}

export type TransitionInput = {
  status: ExpenseStatus;
  paymentMethod?: string; paymentReference?: string; paymentDate?: string;
  notes?: string;
};

export async function transitionExpense(id: string, input: TransitionInput): Promise<ExpenseRequest> {
  const res = await fetch(`/api/budget/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 403) throw new Error("Not authorized — admin only.");
  if (res.status === 409) throw new Error("That status change isn't allowed from the current state.");
  if (!res.ok) throw new Error(`transition ${res.status}`);
  return (await res.json()).expense as ExpenseRequest;
}
```

### `src/features/budget-builder/ProposeExpense.tsx`

```tsx
import React, { useState } from "react";
import { BUDGET_CONFIG } from "./config";
import { proposeExpense } from "./expensesApi";
import { toNumber, formatUSD } from "./money";

/** Open to any authenticated user. Always creates a "Proposed" request. */
export default function ProposeExpense({ onSubmitted }: { onSubmitted?: () => void }) {
  const [f, setF] = useState({ title: "", submittedBy: "", submitterEmail: "", category: "Other", vendor: "", quoteLink: "", quantity: 0, unitPrice: 0, purpose: "", neededBy: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const amount = toNumber(f.quantity) * toNumber(f.unitPrice);

  const submit = async () => {
    if (!f.title || !f.vendor) { setMsg("Add a title and vendor."); return; }
    setBusy(true); setMsg(null);
    try {
      await proposeExpense({ ...f, quantity: toNumber(f.quantity), unitPrice: toNumber(f.unitPrice), amount });
      setMsg("Submitted for review.");
      setF({ title: "", submittedBy: "", submitterEmail: "", category: "Other", vendor: "", quoteLink: "", quantity: 0, unitPrice: 0, purpose: "", neededBy: "" });
      onSubmitted?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not submit.");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h3>Propose an expense</h3>
      <Row label="Title"><input value={f.title} onChange={(e) => set("title", e.target.value)} style={inp} /></Row>
      <Row label="Your name"><input value={f.submittedBy} onChange={(e) => set("submittedBy", e.target.value)} style={inp} /></Row>
      <Row label="Your email"><input value={f.submitterEmail} onChange={(e) => set("submitterEmail", e.target.value)} style={inp} /></Row>
      <Row label="Category">
        <select value={f.category} onChange={(e) => set("category", e.target.value)} style={inp}>
          {BUDGET_CONFIG.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Row>
      <Row label="Vendor"><input value={f.vendor} onChange={(e) => set("vendor", e.target.value)} style={inp} /></Row>
      <Row label="Quote / product link"><input value={f.quoteLink} onChange={(e) => set("quoteLink", e.target.value)} style={inp} placeholder="https://" /></Row>
      <Row label="Quantity"><input inputMode="numeric" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} style={inp} /></Row>
      <Row label="Unit price"><input inputMode="decimal" value={f.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} style={inp} /></Row>
      <Row label="Amount"><strong>{formatUSD(amount)}</strong></Row>
      <Row label="Purpose"><textarea value={f.purpose} onChange={(e) => set("purpose", e.target.value)} style={{ ...inp, minHeight: 64 }} /></Row>
      <Row label="Needed by"><input type="date" value={f.neededBy} onChange={(e) => set("neededBy", e.target.value)} style={inp} /></Row>
      <button disabled={busy} onClick={submit} style={primaryBtn}>{busy ? "Submitting…" : "Submit for review"}</button>
      {msg && <p style={{ marginTop: 10, fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontFamily: "inherit", fontSize: 14 };
const primaryBtn: React.CSSProperties = { marginTop: 8, fontWeight: 600, padding: "10px 16px", borderRadius: 8, border: "none", background: "#21436B", color: "#fff", cursor: "pointer" };
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center", margin: "8px 0", fontSize: 13 }}>
      <span style={{ color: "#43566B", fontWeight: 600 }}>{label}</span>{children}
    </label>
  );
}
```

### `src/features/budget-builder/ExpenseReview.tsx`

```tsx
import React, { useEffect, useState } from "react";
import type { ExpenseRequest, ExpenseStatus } from "./types";
import { EXPENSE_TRANSITIONS } from "./types";
import { listExpenses, transitionExpense } from "./expensesApi";
import { formatUSD } from "./money";

/** Admin-only queue. Render behind the same role guard as other admin routes. */
export default function ExpenseReview() {
  const [rows, setRows] = useState<ExpenseRequest[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = () => listExpenses().then(setRows).catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  const act = async (id: string, status: ExpenseStatus) => {
    setErr(null);
    try {
      let extra = {};
      if (status === "Paid") {
        const ref = window.prompt("Payment reference (check # / txn id):") ?? "";
        const method = window.prompt("Payment method (Card/Check/ACH/Cash/Other):") ?? "Other";
        extra = { paymentReference: ref, paymentMethod: method, paymentDate: new Date().toISOString().slice(0, 10) };
      }
      await transitionExpense(id, { status, ...extra });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed.");
    }
  };

  return (
    <div>
      <h3>Expense review</h3>
      {err && <p style={{ color: "#C0392B", fontSize: 13 }}>{err}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>
            <th style={{ padding: 8 }}>Title</th><th style={{ padding: 8 }}>Vendor</th>
            <th style={{ padding: 8, textAlign: "right" }}>Amount</th><th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid #eef0f3" }}>
              <td style={{ padding: 8, fontWeight: 600 }}>{r.title}<div style={{ fontWeight: 400, color: "#6b7280" }}>{r.submittedBy}</div></td>
              <td style={{ padding: 8 }}>{r.vendor}</td>
              <td style={{ padding: 8, textAlign: "right", fontFamily: "monospace" }}>{formatUSD(r.amount)}</td>
              <td style={{ padding: 8 }}><span style={pill(r.status)}>{r.status}</span></td>
              <td style={{ padding: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {EXPENSE_TRANSITIONS[r.status].map((next) => (
                  <button key={next} onClick={() => act(r.id, next)} style={actionBtn(next)}>{label(next)}</button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const label = (s: ExpenseStatus) => s === "Approved" ? "Accept into budget" : s === "Paid" ? "Mark paid" : s;
function pill(s: string): React.CSSProperties {
  const map: Record<string, string> = { "Proposed": "#A9741A", "Under Review": "#B5791F", "Approved": "#1F7A52", "Paid": "#21436B", "Rejected": "#C0392B", "Archived": "#6b7280" };
  return { fontSize: 11, fontWeight: 600, color: "#fff", background: map[s] ?? "#6b7280", padding: "2px 8px", borderRadius: 999 };
}
function actionBtn(next: ExpenseStatus): React.CSSProperties {
  const danger = next === "Rejected";
  return { fontSize: 12, fontWeight: 600, padding: "5px 9px", borderRadius: 7, cursor: "pointer", border: "1px solid", borderColor: danger ? "#E3B7B2" : "#cbd5e1", background: "#fff", color: danger ? "#C0392B" : "#21436B" };
}
```

### `server/budget/expenses.ts`

```ts
// GET/POST/PATCH for the Expense Requests pipeline. AWS SDK v3 SSM for the PAT.
// Reuse getToken() from server/budget/items.ts instead of duplicating if you prefer.
// Replace the auth stubs with the repo's existing Clerk helpers.

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const PARAM_NAME = process.env.AIRTABLE_PAT_PARAM!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const TABLE_ID = process.env.AIRTABLE_EXPENSES_TABLE ?? "tblpXHQerkk8OYqt3";

const TRANSITIONS: Record<string, string[]> = {
  "Proposed": ["Under Review", "Approved", "Rejected", "Archived"],
  "Under Review": ["Approved", "Rejected", "Proposed", "Archived"],
  "Approved": ["Paid", "Rejected", "Archived"],
  "Paid": ["Archived"],
  "Rejected": ["Archived", "Proposed"],
  "Archived": [],
};

let token: string | null = null;
async function getToken(): Promise<string> {
  if (token) return token;
  const out = await ssm.send(new GetParameterCommand({ Name: PARAM_NAME, WithDecryption: true }));
  if (!out.Parameter?.Value) throw new Error("PAT missing");
  token = out.Parameter.Value;
  return token;
}
const atHeaders = async () => ({ Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" });
const base = () => `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

// --- TODO: wire to the repo's Clerk helpers (same ones the compliance routes use) ---
async function requireUser(req: unknown): Promise<{ id: string; name: string; isAdmin: boolean }> {
  // return { id, name, isAdmin } from Clerk session; throw 401 if no session.
  throw new Error("wire requireUser to Clerk");
}

function mapRow(r: { id: string; fields: Record<string, any> }) {
  const f = r.fields;
  return {
    id: r.id, title: f["Request Title"] ?? "", submittedBy: f["Submitted By"] ?? "",
    submitterEmail: f["Submitter Email"] ?? "", itemId: (f["Item"]?.[0]) ?? null,
    category: f["Category"] ?? "", vendor: f["Vendor"] ?? "", quoteLink: f["Quote / Product Link"] ?? "",
    quantity: Number(f["Quantity"] ?? 0), unitPrice: Number(f["Unit Price"] ?? 0), amount: Number(f["Amount"] ?? 0),
    purpose: f["Purpose / Justification"] ?? "", neededBy: f["Needed By"] ?? null, status: f["Status"] ?? "Proposed",
    reviewedBy: f["Reviewed By"]?.name ?? null, decisionDate: f["Decision Date"] ?? null,
    paymentMethod: f["Payment Method"] ?? null, paymentReference: f["Payment Reference"] ?? null,
    paymentDate: f["Payment Date"] ?? null, notes: f["Notes"] ?? "",
  };
}

export async function handler(req: any) {
  try {
    const user = await requireUser(req);                       // 401 if unauthenticated
    const method = req.method ?? req.requestContext?.http?.method;

    if (method === "GET") {
      const status = req.queryStringParameters?.status;
      const filter = status ? `?filterByFormula=${encodeURIComponent(`{Status}='${status}'`)}` : "";
      const res = await fetch(`${base()}${filter}`, { headers: await atHeaders() });
      const data = await res.json();
      return ok({ expenses: (data.records ?? []).map(mapRow) });
    }

    if (method === "POST") {
      const body = JSON.parse(req.body ?? "{}");
      const qty = Number(body.quantity ?? 0), unit = Number(body.unitPrice ?? 0);
      const amount = qty > 0 && unit > 0 ? qty * unit : Number(body.amount ?? 0); // server recomputes
      const fields = {
        "Request Title": String(body.title ?? "").slice(0, 200),
        "Submitted By": user.name, "Submitter Email": String(body.submitterEmail ?? ""),
        "Category": body.category, "Vendor": String(body.vendor ?? ""),
        "Quote / Product Link": validUrl(body.quoteLink), "Quantity": qty, "Unit Price": unit, "Amount": amount,
        "Purpose / Justification": String(body.purpose ?? ""), "Needed By": body.neededBy || undefined,
        "Status": "Proposed",                                  // always forced
      };
      const res = await fetch(base(), { method: "POST", headers: await atHeaders(), body: JSON.stringify({ records: [{ fields }], typecast: true }) });
      const data = await res.json();
      return ok({ expense: mapRow(data.records[0]) }, 201);
    }

    if (method === "PATCH") {
      if (!user.isAdmin) return err(403, "admin_only");
      const id = req.pathParameters?.id ?? req.params?.id;
      const body = JSON.parse(req.body ?? "{}");
      const cur = await fetch(`${base()}/${id}`, { headers: await atHeaders() }).then((r) => r.json());
      const from = cur.fields?.["Status"] ?? "Proposed";
      const to = body.status;
      if (!TRANSITIONS[from]?.includes(to)) return err(409, "illegal_transition");

      const fields: Record<string, any> = {
        "Status": to, "Reviewed By": undefined, "Decision Date": new Date().toISOString().slice(0, 10),
      };
      if (to === "Paid") {
        fields["Payment Method"] = body.paymentMethod ?? "Other";
        fields["Payment Reference"] = body.paymentReference ?? "";
        fields["Payment Date"] = body.paymentDate ?? new Date().toISOString().slice(0, 10);
      }
      if (body.notes) fields["Notes"] = body.notes;
      const res = await fetch(`${base()}/${id}`, { method: "PATCH", headers: await atHeaders(), body: JSON.stringify({ fields, typecast: true }) });
      const data = await res.json();
      return ok({ expense: mapRow(data) });
    }

    return err(405, "method_not_allowed");
  } catch (e: any) {
    if (String(e?.message).includes("requireUser")) return err(401, "unauthenticated");
    console.error("expenses error", e);
    return err(502, "expenses_failed");
  }
}

const validUrl = (u: unknown) => (/^https?:\/\//i.test(String(u ?? "")) ? String(u) : "");
const json = () => ({ "Content-Type": "application/json", "Cache-Control": "no-store" });
const ok = (b: unknown, statusCode = 200) => ({ statusCode, headers: json(), body: JSON.stringify(b) });
const err = (statusCode: number, error: string) => ({ statusCode, headers: json(), body: JSON.stringify({ error }) });
```

### `.env.example` (append)

```bash
AIRTABLE_EXPENSES_TABLE=tblpXHQerkk8OYqt3
```

## 8. Wiring into the ledger

In `useBudget.ts`, after loading expenses, fold the rollup into the summary so the ledger
shows real money, not just the planning sandbox:

```ts
// inside useBudget, after fetching expenses with listExpenses()
import { rollupExpenses } from "./money";
// const exp = rollupExpenses(expenses);
// const remaining = funds - exp.committed - exp.spent;
// surface: Available | Committed (exp.committed) | Spent (exp.spent) | Remaining
// show exp.pending as a secondary "awaiting review" figure.
```

The catalog qty allocations stay as a **planning** panel ("what a plan would cost"); the
expense rollup is the **authoritative** committed/spent figure.

## 9. Edge cases

- Proposer tries to PATCH → `403` (not admin).
- Approved → Proposed (illegal) → `409`.
- Amount tampering → server recomputes from qty × unit when both present.
- Marking Paid without a reference → allowed but flagged in UI; keep the receipt attachment for the FEC record.
- Deleting is intentionally absent → use **Archived** so nothing leaves the audit trail.

## 10. Test plan (delta)

- State machine: every illegal transition returns 409; every legal one persists.
- Authz: non-admin PATCH = 403; unauthenticated GET/POST = 401.
- Budget math: one Approved + one Paid reduces remaining by their summed amounts; Proposed/Rejected/Archived do not.
- POST forces Proposed even if `status:"Approved"` is sent.

## 11. FEC note (educational, not legal advice)

The "Paid" record captures **payee (vendor), amount, date, and purpose** — the core of an FEC
disbursement entry. Keep the receipt/invoice attached. This supports your filing; it does not
replace the treasurer entering it in the official compliance system, and the "Paid for by …"
disclaimer rules still apply to the materials purchased.
