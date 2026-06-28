"use client";

// Tabs for the Finance page: Plan a purchase / Approvals / Ledger & log.
// `ledger` is the existing server-rendered DynamoDB ledger (passed as a node so
// the page stays a server component); Plan + Approvals are Airtable-backed client
// panels. After any write we router.refresh() so the server-computed stat cards
// (incl. Committed) re-derive.
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import BudgetBuilder from "./BudgetBuilder";
import ProposeExpense from "./ProposeExpense";
import ExpenseReview from "./ExpenseReview";

type Tab = "plan" | "approvals" | "ledger";

export default function FinanceTabs({ ledger, canEdit }: { ledger: ReactNode; canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>("plan");
  const router = useRouter();
  const refresh = () => router.refresh();

  const tabs: { id: Tab; label: string }[] = [
    { id: "plan", label: "Plan a purchase" },
    ...(canEdit ? [{ id: "approvals" as Tab, label: "Approvals" }] : []),
    { id: "ledger", label: "Ledger & log" },
  ];

  return (
    <div>
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? "border-brick text-ink" : "border-transparent text-slate hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "plan" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,380px)]">
          <BudgetBuilder />
          <section className="card h-fit p-6">
            <p className="eyebrow text-slate">Propose an expense</p>
            <p className="mb-4 mt-1 text-xs text-slate">
              Anyone on finance can propose; an admin approves it in the Approvals tab.
            </p>
            <ProposeExpense onSubmitted={refresh} />
          </section>
        </div>
      )}

      {tab === "approvals" && canEdit && <ExpenseReview onChange={refresh} />}

      {tab === "ledger" && <div>{ledger}</div>}
    </div>
  );
}
