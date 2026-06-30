"use client";

import { useMemo } from "react";
import type { DonorRow } from "@/lib/queries";
import { isIn } from "@/lib/engagement";
import { dollars, FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "@/lib/money";
import { DonorThankButton } from "@/components/dashboard/DonorThankButton";
import { DataToolbar } from "@/components/dashboard/DataToolbar";
import { useTableQuery } from "@/components/dashboard/useTableQuery";
import { DONOR_TABLE, type DonorCtx } from "@/lib/table/donors-config";

// volunteerEmails: addresses present in the volunteer list, to flag donors who
// also volunteer. Passed as an array (a Set can't cross the server→client
// boundary) and rebuilt into a Set here for O(1) lookups. Advanced
// search/filter/sort comes from the shared, URL-bound DataToolbar.
export function DonorTable({ rows, volunteerEmails = [] }: { rows: DonorRow[]; volunteerEmails?: string[] }) {
  const volSet = useMemo(() => new Set(volunteerEmails), [volunteerEmails]);
  const ctx = useMemo<DonorCtx>(
    () => ({ volunteerSet: volSet, canSeeVolunteerFlag: volunteerEmails.length > 0 }),
    [volSet, volunteerEmails.length],
  );
  const { state, setState, filtered } = useTableQuery(rows, DONOR_TABLE, ctx);
  const shownTotal = useMemo(() => filtered.reduce((s, d) => s + d.totalCents, 0), [filtered]);

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-line p-3">
        <DataToolbar cfg={DONOR_TABLE} rows={rows} state={state} setState={setState} ctx={ctx} shown={filtered.length} />
        <p className="mt-2 font-mono text-xs text-slate">Showing {dollars(shownTotal)} across {filtered.length} donor{filtered.length === 1 ? "" : "s"}</p>
      </div>

      {filtered.length === 0 ? (
        <p className="p-8 text-center text-slate">No donors match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-line bg-paper text-left">
            <tr className="text-slate">
              <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Donor</th>
              <th className="px-5 py-3 font-mono text-xs uppercase tracking-eyebrow">Employer / Occ.</th>
              <th className="px-5 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Total</th>
              <th className="px-5 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Thank-you</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((d) => {
              const overLimit = d.totalCents > FEC_INDIVIDUAL_PER_ELECTION_CENTS;
              const missingFec = !d.employer || !d.occupation;
              return (
                <tr key={d.id} className="hover:bg-paper">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-ink">
                      {d.name}
                      {isIn(volSet, d.email) && (
                        <span className="ml-2 rounded-sm bg-field/10 px-1.5 py-0.5 align-middle font-mono text-[0.55rem] uppercase tracking-eyebrow text-field" title="Also signed up to volunteer">
                          + volunteer
                        </span>
                      )}
                    </p>
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
                    {d.totalCents === 0 ? (
                      <span className="font-mono text-slate" title="No contribution amount on file — check the donation source (e.g. the WinRed webhook payload).">
                        — <span className="text-[0.6rem] uppercase tracking-eyebrow">no amount</span>
                      </span>
                    ) : (
                      <span className="font-mono font-semibold text-ink">{dollars(d.totalCents)}</span>
                    )}
                    {overLimit && (
                      <span className="ml-2 rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-brick">
                        over limit
                      </span>
                    )}
                    {!overLimit && missingFec && d.totalCents > 20000 && (
                      <span className="ml-2 font-mono text-[0.6rem] text-brick">check FEC</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DonorThankButton id={d.id} name={d.name} email={d.email} thankedAt={d.thankedAt} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
