"use client";

import { useMemo } from "react";
import type { DonorRow } from "@/lib/queries";
import { isIn } from "@/lib/engagement";
import { dollars, FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "@/lib/money";
import { DonorThankButton } from "@/components/dashboard/DonorThankButton";
import { DataTable } from "@/components/dashboard/DataTable";
import { DONOR_TABLE, type DonorCtx } from "@/lib/table/donors-config";
import type { ColumnDef } from "@/lib/table/types";

// Donors on the shared <DataTable> — the reference consumer that exercises the
// hardest cells (over-limit badge, missing-FEC warning, the thank-you action) while
// reusing DONOR_TABLE for search/facets/sort. volunteerEmails arrives as an array
// (a Set can't cross the server→client boundary) and is rebuilt into a Set for O(1)
// lookups in the "+ volunteer" flag.

const COLUMNS: ColumnDef<DonorRow, DonorCtx>[] = [
  {
    key: "name",
    header: "Donor",
    sortable: true,
    cell: (d, ctx) => (
      <>
        <p className="font-semibold text-ink">
          {d.name}
          {isIn(ctx.volunteerSet, d.email) && (
            <span className="ml-2 rounded-sm bg-field/10 px-1.5 py-0.5 align-middle font-mono text-[0.55rem] uppercase tracking-eyebrow text-field" title="Also signed up to volunteer">
              + volunteer
            </span>
          )}
        </p>
        {d.city && <p className="text-xs text-slate">{d.city}</p>}
      </>
    ),
    csv: (d) => d.name,
  },
  {
    key: "employer",
    header: "Employer / Occ.",
    cell: (d) =>
      d.employer || d.occupation ? (
        <span className="text-slate">{d.employer ?? "—"} · {d.occupation ?? "—"}</span>
      ) : (
        <span className="font-mono text-xs text-brick">⚠ FEC info missing</span>
      ),
    csv: (d) => [d.employer, d.occupation].filter(Boolean).join(" · "),
  },
  {
    key: "amount",
    header: "Total",
    align: "right",
    sortable: true,
    cell: (d) => {
      const overLimit = d.totalCents > FEC_INDIVIDUAL_PER_ELECTION_CENTS;
      const missingFec = !d.employer || !d.occupation;
      return (
        <>
          {d.totalCents === 0 ? (
            <span className="font-mono text-slate" title="No contribution amount on file — check the donation source (e.g. the WinRed webhook payload).">
              — <span className="text-[0.6rem] uppercase tracking-eyebrow">no amount</span>
            </span>
          ) : (
            <span className="font-mono font-semibold text-ink">{dollars(d.totalCents)}</span>
          )}
          {overLimit && (
            <span className="ml-2 rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-brick">over limit</span>
          )}
          {!overLimit && missingFec && d.totalCents > 20000 && (
            <span className="ml-2 font-mono text-[0.6rem] text-brick">check FEC</span>
          )}
        </>
      );
    },
    csv: (d) => (d.totalCents / 100).toFixed(2),
  },
  {
    key: "thanked",
    header: "Thank-you",
    align: "right",
    sortable: true,
    cell: (d) => <DonorThankButton id={d.id} name={d.name} email={d.email} thankedAt={d.thankedAt} />,
    csv: (d) => (d.thankedAt ? "thanked" : "not thanked"),
  },
];

export function DonorTable({ rows, volunteerEmails = [] }: { rows: DonorRow[]; volunteerEmails?: string[] }) {
  const volSet = useMemo(() => new Set(volunteerEmails), [volunteerEmails]);
  const ctx = useMemo<DonorCtx>(
    () => ({ volunteerSet: volSet, canSeeVolunteerFlag: volunteerEmails.length > 0 }),
    [volSet, volunteerEmails.length],
  );

  return (
    <DataTable
      columns={COLUMNS}
      config={DONOR_TABLE}
      rows={rows}
      ctx={ctx}
      rowKey={(d) => d.id}
      emptyLabel="No donors match these filters."
      minWidthClass="min-w-[34rem]"
      // The donors page already offers a canonical server-side full-dataset export
      // (/api/dashboard/export/donors); suppress the client one to avoid two buttons.
      hideExport
      summary={(f) => `Showing ${dollars(f.reduce((s, d) => s + d.totalCents, 0))} across ${f.length} donor${f.length === 1 ? "" : "s"}`}
    />
  );
}
