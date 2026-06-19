import { redirect } from "next/navigation";
import { getFinance } from "@/lib/queries";
import { dollars } from "@/lib/money";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { addExpenditure } from "@/app/dashboard/actions";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";

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

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-6">
      <p className="eyebrow text-slate">{label}</p>
      <p className={`mt-3 font-display text-4xl font-semibold ${accent ?? "text-ink"}`}>{value}</p>
    </div>
  );
}

export default async function FinancePage() {
  const { role } = await staffGate();
  if (!can(role, "viewFinanceTotals")) redirect("/dashboard?denied=finance");
  const canEdit = can(role, "editFinance"); // captains read-only
  const f = await getFinance();
  const cash = f.raisedCents - f.spentCents;
  const max = Math.max(1, ...f.byCategory.map((c) => c.cents));

  return (
    <>
      <PageHeader kicker="Finance" title="Money in &amp; out" />

      {!f.connected && <DbNotice />}

      <HowTo
        steps={[
          "Read the three stat cards: raised, spent, and cash on hand (it turns red if it goes negative).",
          "Log spending with the “Log an expenditure” form — payee, amount, and a category (Media, Field, Fundraising, Compliance, Operations, Travel).",
          "Watch the “spend by category” bars to keep the budget balanced across the campaign.",
          "Review the ledger on the right for every recorded disbursement.",
          "Cash on hand here is illustrative — reconcile against bank statements and FEC Form 3 before any report.",
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Raised" value={dollars(f.raisedCents)} accent="text-field" />
        <Stat label="Spent" value={dollars(f.spentCents)} accent="text-brick" />
        <Stat label="Cash on hand" value={dollars(cash)} accent={cash < 0 ? "text-brick" : "text-ink"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
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
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <input name="memo" placeholder="Memo (optional)" className={`${input} w-full`} />
            </div>
            <button type="submit" disabled={!f.connected} className="btn-ink mt-4 w-full disabled:opacity-50">
              Add expenditure
            </button>
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

      <p className="mt-6 text-xs text-slate">
        Cash on hand = receipts − disbursements (illustrative, not a filed FEC figure). Reconcile against bank
        statements and FEC Form 3 before any report. Educational tooling, not legal or accounting advice.
      </p>
    </>
  );
}
