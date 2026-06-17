import { getDonors } from "@/lib/queries";
import { dollars, FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "@/lib/money";
import { DbNotice, PageHeader } from "@/components/dashboard/Notice";
import { addDonor } from "@/app/dashboard/actions";

const input = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

export default async function DonorsPage() {
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
            <select name="method" className={input} defaultValue="WinRed">
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
        <div className="card overflow-hidden p-0">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-slate">No donors yet. Log your first contribution.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-paper text-left">
                <tr className="text-slate">
                  <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Donor</th>
                  <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Employer / Occ.</th>
                  <th className="px-5 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((d) => {
                  const overLimit = d.totalCents > FEC_INDIVIDUAL_PER_ELECTION_CENTS;
                  const missingFec = !d.employer || !d.occupation;
                  return (
                    <tr key={d.id} className="hover:bg-paper">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">{d.name}</p>
                        {d.city && <p className="text-xs text-slate">{d.city}</p>}
                      </td>
                      <td className="px-5 py-3 text-slate">
                        {d.employer || d.occupation ? (
                          <span>
                            {d.employer ?? "—"} · {d.occupation ?? "—"}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-brick">⚠ FEC info missing</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono font-semibold text-ink">{dollars(d.totalCents)}</span>
                        {overLimit && (
                          <span className="ml-2 rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-brick">
                            over limit
                          </span>
                        )}
                        {!overLimit && missingFec && d.totalCents > 20000 && (
                          <span className="ml-2 font-mono text-[0.6rem] text-brick">check FEC</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate">
        Limit flag uses the 2025–26 individual limit of {dollars(FEC_INDIVIDUAL_PER_ELECTION_CENTS)} per election —
        verify against current FEC guidance. Educational tooling, not legal advice.
      </p>
    </>
  );
}
