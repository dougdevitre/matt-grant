import { redirect } from "next/navigation";
import { getFinance } from "@/lib/queries";
import { dollars } from "@/lib/money";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { addExpenditure } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getBudgetSummary } from "@/lib/budget/expenses";
import FinanceTabs from "@/components/budget/FinanceTabs";

const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";
const CATS = ["Media", "Field", "Fundraising", "Compliance", "Operations", "Travel"];

const catColor: Record<string, string> = {
  Media: "bg-brick",
  Field: "bg-field",
  Fundraising: "bg-gold",
  Compliance: "bg-ink",
  Operations: "bg-slate",
  Travel: "bg-[#7c8a52]",
};

function Stat({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="card p-6">
      <p className="eyebrow text-slate">{label}</p>
      <p className={`mt-3 font-display text-4xl font-semibold ${accent ?? "text-ink"}`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-slate">{sub}</p>}
    </div>
  );
}

export default async function FinancePage() {
  const { role } = await staffGate();
  if (!can(role, "viewFinanceTotals")) redirect("/dashboard?denied=finance");
  const canEdit = can(role, "editFinance"); // captains read-only
  const [f, budget] = await Promise.all([getFinance(), getBudgetSummary()]);
  const cash = f.raisedCents - f.spentCents;
  const max = Math.max(1, ...f.byCategory.map((c) => c.cents));

  // The existing DynamoDB ledger + log form, preserved verbatim as the third tab.
  // DynamoDB stays the authoritative source for Raised / Spent / Cash on hand
  // (it also feeds the Overview); the budget pipeline (Airtable) adds the
  // Committed figure plus the Plan and Approvals tabs.
  const ledger = (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {/* Spend by category + add */}
      <div className="space-y-6">
        <div className="card p-6">
          <p className="eyebrow text-slate">Spend by category</p>
          {f.byCategory.length === 0 ? (
            <p className="mt-4 text-sm text-slate">No expenditures yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {f.byCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-ink">{c.category}</span>
                    <span className="font-mono text-slate">{dollars(c.cents)}</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line">
                    <div className={`h-full ${catColor[c.category] ?? "bg-slate"}`} style={{ width: `${(c.cents / max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <form action={addExpenditure} className="card p-6">
            <p className="eyebrow text-slate">Log an expenditure</p>
            <div className="mt-4 space-y-3">
              <input name="payee" required placeholder="Payee" className={`${input} w-full`} />
              <div className="grid grid-cols-2 gap-3">
                <input name="amount" type="number" step="0.01" min="0" placeholder="Amount $" className={input} />
                <select name="category" aria-label="Expenditure category" defaultValue="Operations" className={input}>
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <input name="memo" placeholder="Memo (optional)" className={`${input} w-full`} />
            </div>
            <SubmitButton disabled={!f.connected} pendingText="Adding…" className="btn-ink mt-4 w-full disabled:opacity-50">
              Add expenditure
            </SubmitButton>
          </form>
        )}
      </div>

      {/* Ledger */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-line px-5 py-3">
          <p className="eyebrow text-slate">Expenditure ledger</p>
        </div>
        {f.expenditures.length === 0 ? (
          <p className="p-8 text-center text-slate">No expenditures recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {f.expenditures.map((e) => (
                <tr key={e.id} className="hover:bg-paper">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-ink">{e.payee}</p>
                    {e.memo && <p className="text-xs text-slate">{e.memo}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-field">{e.category}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-ink">{dollars(e.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader kicker="Finance" title="Money in &amp; out" />

      {!f.connected && <DbNotice />}

      <HowTo
        steps={[
          "Read the stat cards: raised, committed (approved but not yet paid), spent, and cash on hand (it turns red if negative).",
          "“Plan a purchase” reads the live Airtable catalog and shows what cash on hand can buy — set funds, add quantities, export the plan.",
          "Anyone on finance can propose an expense; an admin works the “Approvals” tab to accept it into the budget, mark it paid, reject, or archive.",
          "“Ledger & log” is the recorded-disbursements ledger (and, for admins, the quick log form).",
          "Cash on hand here is illustrative — reconcile against bank statements and FEC Form 3 before any report.",
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Raised" value={dollars(f.raisedCents)} accent="text-field" />
        <Stat label="Committed" value={dollars(budget.committedCents)} accent="text-[#9a6f1a]" sub="Approved, not yet paid" />
        <Stat label="Spent" value={dollars(f.spentCents)} accent="text-brick" />
        <Stat label="Cash on hand" value={dollars(cash)} accent={cash < 0 ? "text-brick" : "text-ink"} />
      </div>

      <div className="mt-8">
        <FinanceTabs ledger={ledger} canEdit={canEdit} />
      </div>

      <p className="mt-6 text-xs text-slate">
        Cash on hand = receipts − disbursements (illustrative, not a filed FEC figure). “Committed” is the sum of
        approved-but-unpaid expense requests from the budget planner. Reconcile against bank statements and FEC Form 3
        before any report. Educational tooling, not legal or accounting advice.
      </p>
    </>
  );
}
