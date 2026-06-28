# FINANCE_PAGE_INTEGRATION.md

Third and final spec — folds `budget-builder` and the expense pipeline **into the existing
`/dashboard/finance` page** ("Money in & out"), instead of a separate route.

> **Build order:** apply `BUDGET_BUILDER_BUILD.md`, then `BUDGET_BUILDER_EXPENSES.md`, then this.
> This spec modifies the existing `FinancePage` and adds a summary endpoint, a treasurer-only
> "log an expenditure" path, and one correction to the expense state machine.

---

## 0. Money-safety correction (apply first)

`BUDGET_BUILDER_EXPENSES.md` allowed `Paid → Archived`. That's a bug: archiving a paid item
would drop it out of **Spent** and make Cash on hand jump back up. Fix the transition table in
**both** `types.ts` and `server/budget/expenses.ts`:

```ts
// BEFORE
"Paid": ["Archived"],
// AFTER — Paid is terminal; it is the permanent record of a disbursement
"Paid": [],
// and Archived stays reachable only from non-paid states:
"Proposed": ["Under Review", "Approved", "Rejected", "Archived"],
"Under Review": ["Approved", "Rejected", "Proposed", "Archived"],
"Approved": ["Paid", "Rejected", "Archived"],
"Rejected": ["Archived", "Proposed"],
"Archived": [],
```

Rule going forward: **Spent = Σ Paid** and never loses a record. Archived = abandoned/rejected only.

---

## 1. Goals

- Show the budget builder, approvals queue, and existing ledger as **three tabs** on one page.
- Derive the stat cards (Raised / Committed / Spent / Cash on hand) from one server summary.
- Keep "Log an expenditure" working, but have it write a `Paid` record into the same table.
- Change nothing about the page's look, route, or navigation.

## 2. Non-goals

- No new top-level route or nav item.
- Not redefining the Donors/fundraising source of **Raised** — this spec consumes it via a hook.
- No client-side money math that the server can't reproduce.

## 3. User stories

- As **staff**, I open Finance and see Raised, Committed, Spent, and Cash on hand at a glance.
- As **staff**, I switch to "Plan a purchase," see what cash on hand can buy, and propose an item.
- As an **admin**, I work the Approvals tab: accept into budget, mark paid, reject, archive.
- As the **treasurer**, I use "Log an expenditure" to record money already spent — it posts as Paid.
- As a **non-engineer**, the page reads from Airtable, so I never touch a spreadsheet.

## 4. Assumptions (labeled)

- **ASSUMPTION:** the finance page lives at `src/app/dashboard/finance/FinancePage.tsx` (adjust to your actual path).
- **ASSUMPTION:** **Raised** comes from the existing Donors/fundraising module; this spec calls a `getRaisedTotal()` hook you wire to it. Until wired, it returns `{ total: 0, wired: false }` and the card shows a hint.
- **ASSUMPTION:** Clerk session + a role check (`isTreasurer` / `isAdmin`) already exist — reuse the one the compliance routes use.
- **ASSUMPTION:** expense volume is < a few hundred records; the summary handler paginates if needed.

## 5. Data model (derived summary)

```ts
interface FinanceSummary {
  raised: number;          // from fundraising source (getRaisedTotal)
  raisedWired: boolean;    // false until the donor source is connected
  pending: number;         // Σ amount where status ∈ {Proposed, Under Review}
  committed: number;       // Σ amount where status = Approved
  spent: number;           // Σ amount where status = Paid
  cashOnHand: number;      // raised − spent
  freeToCommit: number;    // cashOnHand − committed
  byCategory: { category: string; spent: number }[]; // Paid grouped by Category
}
```

## 6. API routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/budget/summary` | authenticated | Derived stats + spend-by-category |
| POST | `/api/budget/expenses/paid` | **treasurer/admin** | Log an already-paid expenditure (status `Paid`) |

(`GET/POST/PATCH /api/budget/expenses` from the expenses spec are unchanged.)

## 7. Security

- Summary is read-only and authenticated; it returns only aggregate numbers, no PAT, no raw records.
- The Paid-creation route is **treasurer/admin only** (`403` otherwise) — proposing stays open, but recording a disbursement is privileged.
- Server recomputes `amount` from qty × unit when both are present.
- IAM unchanged — still only `ssm:GetParameter` on the one PAT param.

## 8. Edge cases

- `getRaisedTotal()` not wired → `raised: 0, raisedWired: false`; card shows "Connect fundraising"; Cash on hand still computes (just from −Spent).
- No expenses yet → all sums 0, `byCategory: []`, panels show empty states.
- Non-treasurer hits `/expenses/paid` → 403; the Log form hides for non-treasurers.
- Pagination: summary follows Airtable `offset` until exhausted before returning.

## 9. Test plan

- Summary math: one Approved ($X) + one Paid ($Y) ⇒ `committed=X, spent=Y, cashOnHand=raised−Y, freeToCommit=raised−Y−X`.
- Archiving a Paid record is impossible (state machine) ⇒ Spent never decreases.
- `/expenses/paid` as non-treasurer ⇒ 403; as treasurer ⇒ creates a Paid record and summary Spent rises.
- Tab switching preserves each panel's state; stats refresh after any write.

## 10. Rollout plan

1. Apply the §0 correction.
2. Ship `GET /api/budget/summary`; point the existing stat cards at it (adds Committed).
3. Add the three tabs; mount `BudgetBuilder` / `ExpenseReview` / existing ledger.
4. Swap the Log form's submit to `POST /api/budget/expenses/paid`.
5. Wire `getRaisedTotal()` to the donor source to light up Raised + Cash on hand.

---

## 11. Files

### `src/features/budget-builder/expensesApi.ts` (append)

```ts
import type { FinanceSummary } from "./types";

export async function fetchSummary(): Promise<FinanceSummary> {
  const res = await fetch("/api/budget/summary");
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as FinanceSummary;
}

export type LogPaidInput = {
  title: string; vendor: string; amount: number; category: string;
  purpose?: string; paymentMethod?: string; paymentReference?: string; paymentDate?: string;
};

/** Treasurer-only. Records an already-paid expenditure (status = Paid). */
export async function logExpenditure(input: LogPaidInput) {
  const res = await fetch("/api/budget/expenses/paid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 403) throw new Error("Treasurer access required.");
  if (!res.ok) throw new Error(`log ${res.status}`);
  return (await res.json()).expense;
}
```

### `src/features/budget-builder/types.ts` (append)

```ts
export interface FinanceSummary {
  raised: number;
  raisedWired: boolean;
  pending: number;
  committed: number;
  spent: number;
  cashOnHand: number;
  freeToCommit: number;
  byCategory: { category: string; spent: number }[];
}
```

### `src/features/budget-builder/useFinanceSummary.ts`

```ts
import { useCallback, useEffect, useState } from "react";
import type { FinanceSummary } from "./types";
import { fetchSummary } from "./expensesApi";

const EMPTY: FinanceSummary = {
  raised: 0, raisedWired: false, pending: 0, committed: 0, spent: 0,
  cashOnHand: 0, freeToCommit: 0, byCategory: [],
};

export function useFinanceSummary() {
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchSummary().then(setSummary).catch(() => setSummary(EMPTY)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { summary, loading, refresh };
}
```

### `src/features/budget-builder/LogExpenditure.tsx`

```tsx
import React, { useState } from "react";
import { BUDGET_CONFIG } from "./config";
import { logExpenditure } from "./expensesApi";
import { toNumber, formatUSD } from "./money";

/** Treasurer-only quick form. Records money already spent as a Paid record. */
export default function LogExpenditure({ onLogged }: { onLogged?: () => void }) {
  const [f, setF] = useState({ vendor: "", amount: "", category: "Operations", memo: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const amount = toNumber(f.amount);
    if (!f.vendor || amount <= 0) { setMsg("Add a payee and amount."); return; }
    setBusy(true); setMsg(null);
    try {
      await logExpenditure({
        title: `${f.vendor} — ${formatUSD(amount)}`,
        vendor: f.vendor, amount, category: f.category, purpose: f.memo,
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      setF({ vendor: "", amount: "", category: "Operations", memo: "" });
      setMsg("Expenditure recorded.");
      onLogged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not record.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <input placeholder="Payee" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} style={inp} />
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <input placeholder="Amount $" inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} style={{ ...inp, flex: 1 }} />
        <select value={f.category} onChange={(e) => set("category", e.target.value)} style={{ ...inp, flex: 1 }}>
          {[...BUDGET_CONFIG.categories, "Operations"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input placeholder="Memo (optional)" value={f.memo} onChange={(e) => set("memo", e.target.value)} style={{ ...inp, marginTop: 10 }} />
      <button disabled={busy} onClick={submit} style={primary}>{busy ? "Recording…" : "Add expenditure"}</button>
      {msg && <p style={{ fontSize: 12.5, color: "#6b7280", marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "11px 13px", border: "1px solid #D8D2C4", borderRadius: 9, fontFamily: "inherit", fontSize: 14 };
const primary: React.CSSProperties = { width: "100%", marginTop: 12, background: "#16243A", color: "#fff", border: "none", borderRadius: 9, padding: 14, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 13, cursor: "pointer" };
```

### `src/app/dashboard/finance/FinancePage.tsx` (modify)

```tsx
// Integrate the budget builder into the existing page. Keep your current styling /
// card classes; the inline styles below are placeholders — swap for your design tokens.
import React, { useState } from "react";
import BudgetBuilder from "@/features/budget-builder/BudgetBuilder";
import ExpenseReview from "@/features/budget-builder/ExpenseReview";
import LogExpenditure from "@/features/budget-builder/LogExpenditure";
import { useFinanceSummary } from "@/features/budget-builder/useFinanceSummary";
import { formatUSD0 } from "@/features/budget-builder/money";
// import { useRole } from "@/lib/auth"; // your existing Clerk role hook

type Tab = "plan" | "approvals" | "ledger";

export default function FinancePage() {
  const { summary, loading, refresh } = useFinanceSummary();
  const [tab, setTab] = useState<Tab>("plan");
  // const { isTreasurer } = useRole();
  const isTreasurer = true; // TODO: wire to your role hook

  return (
    <div>
      <div className="page-eyebrow">Finance</div>
      <h2 className="page-title">Money in &amp; out</h2>

      <div className="stat-row" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, margin: "16px 0 22px" }}>
        <Stat k="Raised" v={formatUSD0(summary.raised)} sub={summary.raisedWired ? undefined : "Connect fundraising"} />
        <Stat k="Committed" v={formatUSD0(summary.committed)} sub="Approved, not yet paid" tone="amber" />
        <Stat k="Spent" v={formatUSD0(summary.spent)} tone="red" />
        <Stat k="Cash on hand" v={formatUSD0(summary.cashOnHand)} sub={`${formatUSD0(summary.freeToCommit)} free to commit`} />
      </div>

      <div role="tablist" className="fin-tabs" style={{ display: "flex", gap: 6, borderBottom: "1px solid #D8D2C4", marginBottom: 20 }}>
        <TabBtn id="plan" tab={tab} setTab={setTab}>Plan a purchase</TabBtn>
        <TabBtn id="approvals" tab={tab} setTab={setTab}>Approvals</TabBtn>
        <TabBtn id="ledger" tab={tab} setTab={setTab}>Ledger &amp; log</TabBtn>
      </div>

      {tab === "plan" && <BudgetBuilder /* cashOnHand={summary.cashOnHand} */ />}
      {tab === "approvals" && <ExpenseReview /* onChange={refresh} */ />}
      {tab === "ledger" && (
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
          <div>
            <section className="card">
              <h3 className="sec-h">Spend by category</h3>
              {summary.byCategory.length === 0
                ? <p style={{ color: "#8C877A" }}>No expenditures yet.</p>
                : summary.byCategory.map((c) => (
                    <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0EDE4" }}>
                      <span>{c.category}</span><span style={{ fontFamily: "monospace" }}>{formatUSD0(c.spent)}</span>
                    </div>
                  ))}
            </section>
            {isTreasurer && (
              <section className="card" style={{ marginTop: 20 }}>
                <h3 className="sec-h">Log an expenditure</h3>
                <LogExpenditure onLogged={refresh} />
              </section>
            )}
          </div>
          <section className="card">
            <h3 className="sec-h">Expenditure ledger</h3>
            {/* Reuse your existing ledger list; source it from GET /api/budget/expenses?status=Paid */}
          </section>
        </div>
      )}
      {loading && <span className="sr-only">Loading finance summary…</span>}
    </div>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "#9C2B2B" : tone === "amber" ? "#A9741A" : "#1B2A3A";
  return (
    <div className="card stat">
      <div className="stat-k" style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#9A958A", fontWeight: 600 }}>{k}</div>
      <div className="stat-v" style={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 600, color, marginTop: 10 }}>{v}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#8C877A", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ id, tab, setTab, children }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; children: React.ReactNode }) {
  const active = tab === id;
  return (
    <button role="tab" aria-selected={active} onClick={() => setTab(id)}
      style={{ fontSize: 13, fontWeight: 600, padding: "11px 16px", cursor: "pointer", background: "none", border: "none", borderBottom: `2px solid ${active ? "#9C2B2B" : "transparent"}`, color: active ? "#1B2A3A" : "#8C877A", fontFamily: "inherit" }}>
      {children}
    </button>
  );
}
```

### `server/budget/summary.ts`

```ts
// Derives finance stats from the Expense Requests table. Reuses getToken() from
// server/budget/items.ts (import it rather than redefining). Authenticated read-only.

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const PARAM_NAME = process.env.AIRTABLE_PAT_PARAM!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const TABLE_ID = process.env.AIRTABLE_EXPENSES_TABLE ?? "tblpXHQerkk8OYqt3";

let token: string | null = null;
async function getToken() {
  if (token) return token;
  const out = await ssm.send(new GetParameterCommand({ Name: PARAM_NAME, WithDecryption: true }));
  if (!out.Parameter?.Value) throw new Error("PAT missing");
  return (token = out.Parameter.Value);
}

// TODO: wire to the campaign's donor/fundraising total.
async function getRaisedTotal(): Promise<{ total: number; wired: boolean }> {
  return { total: 0, wired: false };
}

async function fetchAll(): Promise<{ status: string; category: string; amount: number }[]> {
  const headers = { Authorization: `Bearer ${await getToken()}` };
  const rows: { status: string; category: string; amount: number }[] = [];
  let offset: string | undefined;
  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`airtable ${res.status}`);
    const data = await res.json();
    for (const r of data.records ?? []) {
      rows.push({ status: r.fields["Status"] ?? "Proposed", category: r.fields["Category"] ?? "Other", amount: Number(r.fields["Amount"] ?? 0) });
    }
    offset = data.offset;
  } while (offset);
  return rows;
}

const sumWhere = (rows: { status: string; amount: number }[], s: string[]) =>
  rows.reduce((t, r) => (s.includes(r.status) ? t + r.amount : t), 0);

export async function handler() {
  try {
    const [rows, raised] = await Promise.all([fetchAll(), getRaisedTotal()]);
    const pending = sumWhere(rows, ["Proposed", "Under Review"]);
    const committed = sumWhere(rows, ["Approved"]);
    const spent = sumWhere(rows, ["Paid"]);

    const catMap = new Map<string, number>();
    for (const r of rows) if (r.status === "Paid") catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amount);
    const byCategory = [...catMap.entries()].map(([category, s]) => ({ category, spent: s })).sort((a, b) => b.spent - a.spent);

    const body = {
      raised: raised.total, raisedWired: raised.wired,
      pending, committed, spent,
      cashOnHand: raised.total - spent,
      freeToCommit: raised.total - spent - committed,
      byCategory,
    };
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
  } catch (e) {
    console.error("summary error", e);
    return { statusCode: 502, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "summary_failed" }) };
  }
}
```

### `server/budget/expenses.ts` (add the Paid route)

```ts
// Add this branch inside the existing handler, before the generic POST branch.
// Treasurer/admin only. Creates a record already at status = Paid.

if (method === "POST" && (req.rawPath ?? req.path ?? "").endsWith("/paid")) {
  if (!user.isTreasurer && !user.isAdmin) return err(403, "treasurer_only");
  const body = JSON.parse(req.body ?? "{}");
  const amount = Number(body.amount ?? 0);
  if (!body.vendor || amount <= 0) return err(400, "invalid_input");
  const fields = {
    "Request Title": String(body.title ?? `${body.vendor} — ${amount}`).slice(0, 200),
    "Submitted By": user.name, "Vendor": String(body.vendor), "Category": body.category ?? "Other",
    "Amount": amount, "Purpose / Justification": String(body.purpose ?? ""),
    "Status": "Paid", "Reviewed By": undefined,
    "Decision Date": new Date().toISOString().slice(0, 10),
    "Payment Method": body.paymentMethod ?? "Other",
    "Payment Reference": body.paymentReference ?? "",
    "Payment Date": body.paymentDate ?? new Date().toISOString().slice(0, 10),
  };
  const res = await fetch(base(), { method: "POST", headers: await atHeaders(), body: JSON.stringify({ records: [{ fields }], typecast: true }) });
  const data = await res.json();
  return ok({ expense: mapRow(data.records[0]) }, 201);
}
```

### `.env.example`

```bash
# No new variables — reuses AIRTABLE_PAT_PARAM, AIRTABLE_BASE_ID, AIRTABLE_EXPENSES_TABLE.
```

---

## 12. Hand-off

Give Claude Code all three specs in order:

```
docs/BUDGET_BUILDER_BUILD.md
docs/BUDGET_BUILDER_EXPENSES.md
docs/FINANCE_PAGE_INTEGRATION.md
```

Prompt: *"Apply these three specs in order, following the existing captain-toolkit and
FinancePage conventions. Start with the §0 money-safety correction. Don't invent Airtable
field names or the donor source — leave the labeled TODOs."*

## 13. FEC note (educational, not legal advice)

Marking or logging **Paid** captures payee, amount, date, and purpose — the disbursement
record fields. Keep receipts attached on the Airtable record. This supports the treasurer's
filing in the official compliance system; it does not replace it, and "Paid for by …"
disclaimer rules still apply to purchased materials.

---

## Implementation note (as built in this repo)

This repo is **Next.js (`web/`)**, not the Vite/Lambda/`src/` layout the specs assume, so the
build was adapted (per Doug): **additive** integration — DynamoDB stays authoritative for
Raised/Spent/Cash (it also feeds Overview); Airtable adds the planning catalog + approval
pipeline + a new **Committed** card. The treasurer "Log an expenditure" stays on the existing
DynamoDB server action (the `/api/budget/expenses/paid` route in §6 was intentionally **not**
built to avoid a split ledger). Real files live under `web/lib/budget`, `web/app/api/budget`,
and `web/components/budget`; writes are gated by both RBAC and the base's Front-End Access
control table.
