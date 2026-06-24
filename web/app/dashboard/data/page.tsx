import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { DataHub, type HubRow } from "@/components/data/DataHub";
import { loadPrintTracker } from "@/lib/data/printTracker";
import renditions from "@/lib/printRenditions.json";
import { SOURCES } from "@/lib/data/registry";

export const dynamic = "force-dynamic";

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

export default function DataHubPage() {
  // Server-side: validated CSV counts + a small sample for the preview panel.
  const print = loadPrintTracker();
  const designs = (renditions.designs as Array<{ label: string }>) ?? [];

  const rows: HubRow[] = SOURCES.map((entry) => {
    const row: HubRow = { entry };
    if (entry.kind === "api") row.enabled = entry.enabledEnv ? entry.enabledEnv.every(envPresent) : true;
    if (entry.id === "print-tracker") {
      row.liveCount = print.ok ? print.meta.count : undefined;
      row.sample = print.ok ? print.data.slice(0, 3).map((i) => i.item) : [];
    }
    if (entry.id === "print-renditions") {
      row.liveCount = designs.length;
      row.sample = designs.slice(0, 3).map((d) => d.label);
    }
    return row;
  });

  return (
    <>
      <PageHeader kicker="Strategy" title="Data sources">
        <Link href="/dashboard/print" className="btn-ghost text-sm">
          Print tracker →
        </Link>
      </PageHeader>
      <p className="mb-6 max-w-prose text-sm text-slate">
        Every data source the app reads — CSV manifests, live APIs, and geo layers — in one place,
        each shown with the same provenance and state. CSV rows ship in the build; API rows degrade to
        a notice when their keys are unset; geo layers fall back to sample boundaries. See{" "}
        <span className="font-mono text-xs">web/docs/data-architecture.md</span> for the contract.
      </p>
      <HowTo
        steps={[
          "The health bar sums every source's status; “Check all” live-pings the checkable ones (geo + opted-in) at once.",
          "A degraded or unconfigured source shows the exact fix — the env var to set, or the command to regenerate it.",
          "Expand a card’s “Preview” to see a few real values and confirm the source returns what you expect.",
          "CSV manifests are generated from a file and committed; edit the source and re-run its generator.",
        ]}
      />
      <DataHub rows={rows} />
    </>
  );
}
