import { redirect } from "next/navigation";
import { getDonors } from "@/lib/queries";
import { dollars, FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "@/lib/money";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { addDonor } from "@/app/dashboard/actions";
import { DonorTable } from "@/components/dashboard/DonorTable";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";

const input = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

export default async function DonorsPage() {
  const { role } = await staffGate();
  if (!can(role, "viewFinanceTotals")) redirect("/dashboard?denied=donors");
  const full = can(role, "viewDonorDetail"); // captains see totals only
  const { connected, rows } = await getDonors();
  const total = rows.reduce((s, r) => s + r.totalCents, 0);

  return (
    <>
      <PageHeader kicker="Finance" title="Donors">
        {connected && (
          <span className="font-mono text-sm text-slate">
            {rows.length} donors · {dollars(total)} raised
          </span>
        )}
      </PageHeader>

      {!connected && <DbNotice />}

      <HowTo
        steps={[
          "Log a contribution in the left form: name, amount, and — for individuals over $200/cycle — employer and occupation, which the FEC requires.",
          "Pick the method (WinRed, check, cash, in-kind) and click Add donor.",
          "Scan the table: a red “⚠ FEC info missing” or “check FEC” flag means go back and fill in employer/occupation.",
          "An “over limit” badge means the donor passed the per-election individual limit — verify before depositing.",
          "Educational tooling, not legal advice; reconcile against your committee records.",
        ]}
      />

      {full ? (
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Add donor */}
        <form action={addDonor} className="card h-fit p-6">
          <p className="eyebrow text-slate">Log a contribution</p>
          <div className="mt-4 space-y-3">
            <input name="name" required placeholder="Donor name" className={input} />
            <input name="email" placeholder="Email" className={input} />
            <div className="grid grid-cols-2 gap-3">
              <input name="city" placeholder="City" className={input} />
              <input name="amount" type="number" step="0.01" min="0" placeholder="Amount $" className={input} />
            </div>
            <input name="employer" placeholder="Employer (FEC)" className={input} />
            <input name="occupation" placeholder="Occupation (FEC)" className={input} />
            <select name="method" aria-label="Contribution method" className={input} defaultValue="WinRed">
              <option>WinRed</option>
              <option>check</option>
              <option>cash</option>
              <option>in-kind</option>
            </select>
          </div>
          <button type="submit" disabled={!connected} className="btn-ink mt-4 w-full disabled:opacity-50">
            Add donor
          </button>
          <p className="mt-3 text-xs text-slate">
            Employer &amp; occupation are required by the FEC for individuals over $200/cycle.
          </p>
        </form>

        {/* List */}
        {rows.length === 0 ? (
          <div className="card p-8 text-center text-slate">No donors yet. Log your first contribution.</div>
        ) : (
          <DonorTable rows={rows} />
        )}
      </div>
      ) : (
        <div className="card p-6">
          <p className="eyebrow text-slate">Totals (read-only)</p>
          <p className="mt-3 text-sm text-slate">
            {rows.length} donors · <span className="font-semibold text-ink">{dollars(total)}</span> raised.
            Captains see totals only — donor names, contact details, and logging are limited to admins.
          </p>
        </div>
      )}

      <p className="mt-6 text-xs text-slate">
        Limit flag uses the 2025–26 individual limit of {dollars(FEC_INDIVIDUAL_PER_ELECTION_CENTS)} per election —
        verify against current FEC guidance. Educational tooling, not legal advice.
      </p>
    </>
  );
}
