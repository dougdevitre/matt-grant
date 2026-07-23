import type { SmsInsightsReadiness as Readiness } from "@/lib/reports/smsInsights";
import { RunEnrichmentButton } from "@/components/dashboard/RunEnrichmentButton";
import { relTime } from "@/lib/relativeTime";

// Data-side readiness panel for the SMS go-live page — the companion to the Twilio
// creds panel. Tells staff whether the composer's priority-tier presets + budget
// coverage reflect REAL voters yet, or are still showing the disabled empty state.
// Presentational (server-rendered); the numbers come from smsInsightsReadiness().

const YES = "bg-field/15 text-field";
const NO = "bg-gold/20 text-ink";

export function SmsInsightsReadiness({ readiness }: { readiness: Readiness }) {
  const { voterFileLoaded, optedIn, scored, scoredPct, lastEnrichedAt, ready } = readiness;
  const enriched = lastEnrichedAt !== null;
  const pct = Math.round(scoredPct);

  return (
    <div className="card mt-6 p-5">
      <p className="eyebrow text-brick">Insight data (drives the priority presets)</p>
      <p className="mt-1 text-xs text-slate">
        The composer&rsquo;s <span className="font-semibold">Who to reach — by likelihood to vote</span> presets
        and budget coverage only reflect real voters once the voter file is ingested and enrichment has run.
      </p>
      <div className="mt-3 divide-y divide-line">
        <div className="flex items-center gap-3 py-2.5">
          <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${voterFileLoaded ? YES : NO}`}>
            {voterFileLoaded ? "Loaded" : "Not loaded"}
          </span>
          <span className="min-w-0 flex-1 text-sm text-ink">Voter file ingested</span>
          <span className="shrink-0 font-mono text-[0.65rem] text-slate">ingest-voters.ts</span>
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${enriched ? YES : NO}`}>
            {enriched ? relTime(lastEnrichedAt) : "never"}
          </span>
          <span className="min-w-0 flex-1 text-sm text-ink">Enrichment last run</span>
          <span className="shrink-0 font-mono text-[0.65rem] text-slate">enrich:sms</span>
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${scored > 0 ? YES : NO}`}>
            {pct}% scored
          </span>
          <span className="min-w-0 flex-1 text-sm text-ink">
            Opted-in numbers matched to a voter score
          </span>
          <span className="shrink-0 font-mono text-[0.65rem] tabular-nums text-slate">
            {scored.toLocaleString()} / {optedIn.toLocaleString()}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate">
        {ready ? (
          "Presets are live — the composer ranks and targets by these voter scores."
        ) : !voterFileLoaded ? (
          <>Run <span className="font-mono">ingest-voters.ts --from-s3</span>, then <span className="font-mono">npm run enrich:sms</span>, to light up the presets. Until then blasts go to all opted-in numbers.</>
        ) : (
          <>Voter file is loaded — run enrichment (or wait for the nightly job) to tag the opted-in ledger. Until then blasts go to all opted-in numbers.</>
        )}
      </p>
      {/* One-click enrichment — disabled until the voter file is ingested. */}
      <RunEnrichmentButton disabled={!voterFileLoaded} />
    </div>
  );
}
