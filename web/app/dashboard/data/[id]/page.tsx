import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/Notice";
import { DegradedNotice, Empty, ErrorState, ProvenanceChip } from "@/components/data/ResourceState";
import { CensusTable } from "@/components/data/CensusTable";
import { ChildActTable } from "@/components/data/ChildActTable";
import { requireCap } from "@/lib/auth";
import { SOURCES } from "@/lib/data/registry";
import { loadCensusCounties } from "@/lib/integrations/census/view";
import { loadChildActBills } from "@/lib/analysis/childActView";
import type { Provenance } from "@/lib/data/resource";

// Rendered read view for a single data source (the hub's "View data →" target). Only
// sources flagged `detail` in the registry resolve here; everything else 404s. Live
// at request time (never prerendered), so the build won't call the Census API.
export const dynamic = "force-dynamic";

function Frame({
  label, owner, note, meta, children,
}: {
  label: string;
  owner: string;
  note?: string;
  meta: Provenance;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader kicker="Data source" title={label}>
        <Link href="/dashboard/data" className="btn-ghost text-sm">← Data hub</Link>
      </PageHeader>
      <p className="mb-1 font-mono text-xs text-slate">{owner}</p>
      {note && <p className="mb-3 max-w-prose text-sm text-slate">{note}</p>}
      <div className="mb-4"><ProvenanceChip meta={meta} /></div>
      {meta.degraded && <DegradedNotice reason={meta.degraded.reason} source={meta.source} />}
      {children}
    </>
  );
}

export default async function DataDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("viewResearch");
  const { id } = await params;
  const entry = SOURCES.find((s) => s.id === id && s.detail);
  if (!entry) notFound();

  if (id === "census") {
    const res = await loadCensusCounties();
    return (
      <Frame label={entry.label} owner={entry.owner} note={entry.note} meta={res.meta}>
        {!res.ok ? (
          <ErrorState error={res.error} />
        ) : res.data.length === 0 ? (
          <Empty title="No county data">The Census fetch returned no rows — try the hub&apos;s “Check now”, or set a CENSUS_API_KEY if you are being rate-limited.</Empty>
        ) : (
          <CensusTable rows={res.data} />
        )}
      </Frame>
    );
  }

  if (id === "child-act") {
    const res = await loadChildActBills();
    return (
      <Frame label={entry.label} owner={entry.owner} note={entry.note} meta={res.meta}>
        {!res.ok ? (
          <ErrorState error={res.error} />
        ) : res.data.bills.length === 0 ? (
          <Empty title="No bills yet">
            No family-court-relevant bills in the ingested record.{" "}
            {entry.remedy ? <span className="font-mono text-xs">{entry.remedy}</span> : null}
          </Empty>
        ) : (
          <ChildActTable data={res.data} />
        )}
      </Frame>
    );
  }

  notFound();
}
