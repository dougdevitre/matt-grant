"use client";

// Admin-only approvals queue (rendered only when canEdit). Disposition each
// request along the legal transitions from the shared state machine. The server
// re-checks both the transition and the editFinance capability.
import { useCallback, useEffect, useState } from "react";
import type { ExpenseRequest, ExpenseStatus } from "@/lib/budget/types";
import { EXPENSE_TRANSITIONS } from "@/lib/budget/types";
import { formatUSD } from "@/lib/budget/plan";

const PILL: Record<ExpenseStatus, string> = {
  Proposed: "bg-gold/15 text-[#9a6f1a]",
  "Under Review": "bg-gold/15 text-[#9a6f1a]",
  Approved: "bg-field/10 text-field",
  Paid: "bg-ink/10 text-ink",
  Rejected: "bg-brick/10 text-brick",
  Archived: "bg-line text-slate",
};

const actionLabel = (s: ExpenseStatus) =>
  s === "Approved" ? "Accept into budget" : s === "Paid" ? "Mark paid" : s;

export default function ExpenseReview({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/budget/expenses")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { expenses: ExpenseRequest[] }) => setRows(d.expenses ?? []))
      .catch(() => setErr("Could not load requests."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, status: ExpenseStatus) => {
    setErr(null);
    let extra: Record<string, string> = {};
    if (status === "Paid") {
      const ref = window.prompt("Payment reference (check # / txn id):") ?? "";
      const method = window.prompt("Payment method (Card/Check/ACH/Cash/Other):") ?? "Other";
      extra = { paymentReference: ref, paymentMethod: method };
    }
    try {
      const res = await fetch(`/api/budget/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (res.status === 409) throw new Error("That status change isn’t allowed from the current state.");
      if (res.status === 403) throw new Error("Admin access required.");
      if (!res.ok) throw new Error(`update ${res.status}`);
      load();
      onChange?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed.");
    }
  };

  if (loading) return <p className="card p-8 text-center text-slate">Loading requests…</p>;

  return (
    <div className="space-y-3">
      {err && <p className="rounded-sm border border-brick/40 bg-brick/5 px-4 py-2 text-sm text-brick">{err}</p>}
      <div className="card overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-slate">No expense requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 eyebrow text-slate">Request</th>
                <th className="px-4 py-3 eyebrow text-slate">Vendor</th>
                <th className="px-4 py-3 eyebrow text-slate text-right">Amount</th>
                <th className="px-4 py-3 eyebrow text-slate">Status</th>
                <th className="px-4 py-3 eyebrow text-slate">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-paper">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{r.title || "(untitled)"}</p>
                    <p className="text-xs text-slate">{r.submittedBy}</p>
                  </td>
                  <td className="px-4 py-3 text-slate">{r.vendor}</td>
                  <td className="px-4 py-3 text-right font-mono text-ink">{formatUSD(r.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {EXPENSE_TRANSITIONS[r.status].length === 0 ? (
                        <span className="text-xs text-slate">—</span>
                      ) : (
                        EXPENSE_TRANSITIONS[r.status].map((next) => (
                          <button
                            key={next}
                            onClick={() => act(r.id, next)}
                            className={`rounded-sm border px-2.5 py-1 text-xs font-semibold ${
                              next === "Rejected"
                                ? "border-brick/40 text-brick hover:bg-brick/5"
                                : "border-line text-ink hover:border-ink"
                            }`}
                          >
                            {actionLabel(next)}
                          </button>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
