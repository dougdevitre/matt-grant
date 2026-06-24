import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { SourceCard } from "@/components/data/SourceCard";
import { loadPrintTracker } from "@/lib/data/printTracker";
import { KIND_LABEL, SOURCES_BY_KIND } from "@/lib/data/registry";
import type { SourceKind } from "@/lib/data/resource";

export const dynamic = "force-dynamic";

const KINDS: SourceKind[] = ["csv", "api", "geo"];

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0;
}

export default function DataHubPage() {
  // CSV rows can show a real, validated count from their loader (Resource pattern).
  const print = loadPrintTracker();
  const liveCount: Record<string, number | undefined> = {
    "print-tracker": print.ok ? print.meta.count : undefined,
  };

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
          "Pick the source you need — grouped by how it's retrieved (CSV / API / geo).",
          "CSV manifests are generated from a file and committed; edit the source and re-run its generator.",
          "API rows show whether their keys are configured; unset keys degrade the feature gracefully.",
          "For geo layers, “Check now” pings the (cached) endpoint and shows its live provenance.",
        ]}
      />

      {KINDS.map((kind) => (
        <section key={kind} className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">{KIND_LABEL[kind]}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {SOURCES_BY_KIND[kind].map((entry) => (
              <SourceCard
                key={entry.id}
                entry={entry}
                enabled={
                  entry.kind === "api"
                    ? entry.enabledEnv
                      ? entry.enabledEnv.every(envPresent)
                      : true
                    : undefined
                }
                liveCount={liveCount[entry.id]}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
