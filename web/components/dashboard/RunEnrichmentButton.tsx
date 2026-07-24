"use client";

import { useState, useTransition } from "react";
import { runEnrichmentNow, type RunEnrichmentState } from "@/app/dashboard/sms/go-live/actions";

// One-click enrichment from the console — the dashboard equivalent of
// `npm run enrich:sms`. Tags the opted-in ledger with the latest voter scores so the
// composer's priority presets show real counts. Disabled until the voter file is
// ingested (enrichment writes nothing without it); the action re-checks admin rights.
export function RunEnrichmentButton({ disabled }: { disabled: boolean }) {
  const [res, setRes] = useState<RunEnrichmentState | null>(null);
  const [pending, start] = useTransition();

  const run = () => start(async () => setRes(await runEnrichmentNow()));

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={run}
        disabled={disabled || pending}
        className="btn-ghost disabled:opacity-50"
      >
        {pending ? "Enriching…" : "Run enrichment now"}
      </button>
      {disabled && (
        <p className="mt-1 text-xs text-slate">Ingest the voter file first — enrichment has nothing to tag until then.</p>
      )}
      {res && <p className={`mt-1 text-sm ${res.ok ? "text-field" : "text-brick"}`}>{res.message}</p>}
    </div>
  );
}
