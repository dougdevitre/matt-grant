import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { DegradedNotice, Empty, ErrorState, ProvenanceChip } from "@/components/data/ResourceState";
import { loadPrintTracker, type PrintItem } from "@/lib/data/printTracker";
import { requireCap } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Fixed category order so the queue reads top-to-bottom the way the team works
// it; anything unrecognized falls to the end.
const CATEGORY_ORDER = [
  "Correspondence",
  "Flyers & handouts",
  "Field & event",
  "Candidate & press",
  "Administrative",
];

function groupByCategory(rows: PrintItem[]) {
  const groups = new Map<string, PrintItem[]>();
  for (const row of rows) {
    const list = groups.get(row.category) ?? [];
    list.push(row);
    groups.set(row.category, list);
  }
  return [...groups.entries()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
  );
}

function Flag({ label }: { label: string }) {
  return (
    <span className="mr-1 inline-block rounded-sm bg-brick/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ready = status === "Draft ready" || status === "In hand";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${
        ready ? "bg-field/10 text-field" : "bg-ink/5 text-slate"
      }`}
    >
      {status || "—"}
    </span>
  );
}

export default async function PrintTrackerPage() {
  await requireCap("manageAssets");
  // Reference slice for the shared data layer: a validated Resource from the
  // committed CSV manifest (see lib/data/printTracker.ts + docs/data-architecture.md).
  const res = loadPrintTracker();
  const grouped = res.ok ? groupByCategory(res.data) : [];
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

      {grouped.map(([category, rows]) => (
        <section key={category} className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">{category}</h2>
          <div className="overflow-x-auto rounded-sm border border-line">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Template</th>
                  <th className="px-3 py-2 font-medium">Sheet</th>
                  <th className="px-3 py-2 font-medium">Flags</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.item} className="border-b border-line/60 last:border-0 align-top">
                    <td className="px-3 py-2.5 font-medium text-ink">{row.item}</td>
                    <td className="px-3 py-2.5">
                      <code className="font-mono text-xs text-slate">{row.template}</code>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate">{row.sheet_size}</td>
                    <td className="px-3 py-2.5">
                      {row.disclaimer_required === "Y" && <Flag label="Disclaimer" />}
                      {row.solicitation_tax_line === "Y" && <Flag label="Tax line" />}
                      {row.internal_only === "Y" && <Flag label="Internal" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
