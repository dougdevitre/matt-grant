import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { DegradedNotice, Empty, ErrorState, ProvenanceChip } from "@/components/data/ResourceState";
import { loadPrintTracker } from "@/lib/data/printTracker";
import { PrintTable } from "@/components/dashboard/PrintTable";
import { requireCap } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrintTrackerPage() {
  await requireCap("manageAssets");
  // Reference slice for the shared data layer: a validated Resource from the
  // committed CSV manifest (see lib/data/printTracker.ts + docs/data-architecture.md).
  const res = loadPrintTracker();
  return (
    <>
      <PageHeader kicker="Comms" title="Print tracker">
        <Link href="/print" className="btn-ghost text-sm">
          Public Print Studio →
        </Link>
      </PageHeader>
      <div className="mb-4">
        <ProvenanceChip meta={res.meta} />
      </div>
      {res.ok && res.meta.degraded && (
        <DegradedNotice reason={res.meta.degraded.reason} source={res.meta.source} />
      )}
      {!res.ok && <ErrorState error={res.error} />}
      {res.ok && res.data.length === 0 && (
        <Empty title="No printables yet">
          Add rows to <span className="font-mono">candidate/letters/print-tracker.csv</span> and run{" "}
          <span className="font-mono">npm run print-tracker</span>.
        </Empty>
      )}
      <p className="mb-6 max-w-prose text-sm text-slate">
        Every letter-sized (8.5 × 11) printable the campaign produces, tied to the template that
        generates it, with the compliance flags and production status for each. This is the staff
        view of <span className="font-mono text-xs">candidate/letters/print-tracker.csv</span> — edit
        that file and run <span className="font-mono text-xs">npm run print-tracker</span> to refresh
        it. For supporter-facing same-day photo prints, use the{" "}
        <Link href="/print" className="underline">Print Studio</Link>; for downloadable graphics see{" "}
        <Link href="/media" className="underline">Media</Link>.
      </p>
      <HowTo
        steps={[
          "Find the piece you need below and open its template path (in the campaign repo) to draft the copy.",
          "Check the flags: “Disclaimer” needs the “Paid for by…” line, “Tax line” needs the not-deductible solicitation notice, “Internal” means staff-only (no public disclaimer).",
          "Pick a print route — Library DIY, Walgreens same-day, or a print vendor/mail house.",
          "Log quantity, vendor, cost, and dates in the CSV, then re-run npm run print-tracker so this view matches.",
        ]}
      />

      {res.ok && res.data.length > 0 && <PrintTable rows={res.data} />}
    </>
  );
}
