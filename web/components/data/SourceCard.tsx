"use client";

// One card per data source on the Data hub. Static provenance + config status is
// computed server-side and passed in. Checkable sources (geo + opted-in `checkable`)
// can be live-pinged — individually ("Check now") or together (the hub's "Check all",
// via the shared `checkNonce`). Each card reports its resolved status up so the hub
// header can summarize health. An expandable preview shows a few real values.
import { useEffect, useRef } from "react";
import type { SourceEntry } from "@/lib/data/registry";
import type { SourceKind } from "@/lib/data/resource";
import { useResource } from "@/lib/data/useResource";
import { type HubKind, previewOf, remedyFor } from "@/lib/data/hubStatus";
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

export type SourceCardProps = {
  entry: SourceEntry;
  /** API only: are the gating env vars present? */
  enabled?: boolean;
  /** CSV only: validated row count from the server-side Resource. */
  liveCount?: number;
  /** CSV only: first few labels for the preview panel. */
  sample?: string[];
  /** Bumped by the hub's "Check all" to trigger every checkable card at once. */
  checkNonce?: number;
  /** Report this card's resolved status up to the hub header. */
  onStatus?: (id: string, kind: HubKind, checkedAt: number | null) => void;
};

export function SourceCard({ entry, enabled, liveCount, sample, checkNonce = 0, onStatus }: SourceCardProps) {
  // Geo routes are always safe GETs; other kinds opt in via `checkable` in the registry.
  const canCheck = !!entry.endpoint && (entry.kind === "geo" || !!entry.checkable);
  const { state, data, meta, error, lastFetchedAt, reload } = useResource(entry.endpoint ?? "", { manual: true });
  const triggered = useRef(0);

  // Fire the live check when the hub's "Check all" nonce advances.
  useEffect(() => {
    if (canCheck && checkNonce > 0 && checkNonce !== triggered.current) {
      triggered.current = checkNonce;
      reload();
    }
  }, [checkNonce, canCheck, reload]);

  // Resolve this card to a single status for the header.
  const kind: HubKind = (() => {
    if (canCheck && state !== "idle") {
      if (state === "loading") return "idle";
      if (state === "error") return "error";
      if (state === "degraded") return "degraded";
      return "live"; // ready | empty (reachable)
    }
    if (entry.kind === "api") return enabled ? "configured" : "unconfigured";
    if (entry.kind === "csv") return "live";
    return "idle"; // geo not checked yet
  })();

  useEffect(() => {
    onStatus?.(entry.id, kind, canCheck ? lastFetchedAt : null);
  }, [onStatus, entry.id, kind, canCheck, lastFetchedAt]);

  const remedy = remedyFor(entry, kind);
  const checkedData = canCheck && (state === "ready" || state === "degraded") ? data : null;
  const preview = sample?.length ? sample : checkedData ? previewOf(checkedData) : [];

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
            v={enabled ? "configured" : `not configured${entry.enabledEnv ? ` — set ${entry.enabledEnv.join(", ")}` : ""}`}
          />
        )}
      </dl>

      {/* Fix-it line for any bad state */}
      {remedy && (
        <div className="mt-3 rounded-sm border border-gold/50 bg-gold/10 px-3 py-2 text-xs text-ink">
          <span className="font-semibold">{remedy.label}: </span>
          <span className="font-mono text-[0.7rem] text-slate">{remedy.hint}</span>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <details className="mt-3 text-xs text-slate">
          <summary className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-eyebrow text-field">Preview</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {preview.map((p, i) => (
              <li key={i} className="truncate">{p}</li>
            ))}
          </ul>
        </details>
      )}

      {canCheck && (
        <div className="mt-3 flex items-center gap-3 border-t border-line/60 pt-2">
          <button className="btn-ghost text-xs" onClick={() => reload()} disabled={state === "loading"}>
            {state === "loading" ? "Checking…" : state === "idle" ? "Check now" : "Re-check"}
          </button>
          {state === "error" ? (
            <span className="text-xs text-brick">{error ?? "check failed"}</span>
          ) : state !== "idle" && state !== "loading" ? (
            <ProvenanceChip meta={meta} />
          ) : null}
        </div>
      )}
    </div>
  );
}
