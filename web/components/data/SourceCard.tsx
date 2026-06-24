"use client";

// One card per data source on the Data hub. Static provenance + config status is
// computed server-side and passed in; for the safe, ISR-cached geo endpoints the
// staffer can fire an on-demand live check (demonstrates the useResource seam
// without hammering external APIs on page load).
import { useState } from "react";
import type { SourceEntry } from "@/lib/data/registry";
import type { SourceKind } from "@/lib/data/resource";
import { useResource } from "@/lib/data/useResource";
import { ProvenanceChip } from "./ResourceState";

const KIND_STYLE: Record<SourceKind, string> = {
  csv: "bg-field/10 text-field",
  api: "bg-brick/10 text-brick",
  geo: "bg-gold/15 text-ink",
};

function KindBadge({ kind }: { kind: SourceKind }) {
  return (
    <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${KIND_STYLE[kind]}`}>
      {kind}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate/70">{k}</dt>
      <dd className="font-mono text-[0.65rem] text-slate">{v}</dd>
    </div>
  );
}

function LiveCheck({ url }: { url: string }) {
  const { state, meta, error } = useResource(url);
  if (state === "loading")
    return <span className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">Checking…</span>;
  if (state === "error") return <span className="text-xs text-brick">{error ?? "check failed"}</span>;
  return <ProvenanceChip meta={meta} />;
}

export function SourceCard({
  entry,
  enabled,
  liveCount,
}: {
  entry: SourceEntry;
  /** API only: are the gating env vars present? */
  enabled?: boolean;
  /** CSV only: validated row count from the server-side Resource. */
  liveCount?: number;
}) {
  const [checking, setChecking] = useState(false);
  // Geo routes are always safe GETs; other kinds opt in via `checkable` in the registry.
  const canCheck = !!entry.endpoint && (entry.kind === "geo" || !!entry.checkable);

  return (
    <div className="rounded-sm border border-line bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{entry.label}</span>
        <KindBadge kind={entry.kind} />
      </div>
      <p className="mt-1 font-mono text-[0.65rem] text-slate">{entry.owner}</p>
      {entry.note && <p className="mt-2 text-sm text-slate">{entry.note}</p>}

      <dl className="mt-3 space-y-1">
        {entry.manifest && <Row k="Manifest" v={entry.manifest} />}
        {typeof liveCount === "number" && <Row k="Rows" v={String(liveCount)} />}
        {entry.endpoint && <Row k="Endpoint" v={entry.endpoint} />}
        <Row k="Cache" v={entry.cache} />
        {entry.kind === "api" && (
          <Row
            k="Status"
            v={
              enabled
                ? "configured"
                : `not configured${entry.enabledEnv ? ` — set ${entry.enabledEnv.join(", ")}` : ""}`
            }
          />
        )}
      </dl>

      {canCheck && (
        <div className="mt-3 border-t border-line/60 pt-2">
          {!checking ? (
            <button className="btn-ghost text-xs" onClick={() => setChecking(true)}>
              Check now
            </button>
          ) : (
            <LiveCheck url={entry.endpoint!} />
          )}
        </div>
      )}
    </div>
  );
}
