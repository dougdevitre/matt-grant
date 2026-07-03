"use client";

// Client controller for the Data hub: a health bar that summarizes every source's
// status, a "Check all" that live-pings the checkable ones at once, and the
// kind-grouped grid of SourceCards (which report their status up via onStatus).
import { useCallback, useMemo, useState } from "react";
import type { SourceEntry } from "@/lib/data/registry";
import { KIND_LABEL } from "@/lib/data/registry";
import type { SourceKind } from "@/lib/data/resource";
import { type HubKind, summarize } from "@/lib/data/hubStatus";
import { SourceCard } from "./SourceCard";

export type HubRow = {
  entry: SourceEntry;
  enabled?: boolean;
  liveCount?: number;
  sample?: string[];
};

// Derived from KIND_LABEL (not a hand-kept literal) so adding a SourceKind can't
// silently drop a group — a new kind renders as soon as it has a label.
const KINDS = Object.keys(KIND_LABEL) as SourceKind[];

function Pill({ color, n, label }: { color: string; n: number; label: string }) {
  if (n === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />
      {n} {label}
    </span>
  );
}

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function DataHub({ rows }: { rows: HubRow[] }) {
  const [checkNonce, setCheckNonce] = useState(0);
  const [lastCheckAll, setLastCheckAll] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<Record<string, HubKind>>({});

  const onStatus = useCallback((id: string, kind: HubKind) => {
    setStatuses((s) => (s[id] === kind ? s : { ...s, [id]: kind }));
  }, []);

  const counts = useMemo(
    () => summarize(rows.map((r) => statuses[r.entry.id] ?? "idle")),
    [rows, statuses],
  );
  const checkableCount = rows.filter((r) => r.entry.endpoint && (r.entry.kind === "geo" || r.entry.checkable)).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-line bg-paper/60 px-4 py-3">
        <Pill color="bg-field" n={counts.live} label="live" />
        <Pill color="bg-gold" n={counts.degraded} label="degraded" />
        <Pill color="bg-brick" n={counts.error} label="error" />
        <Pill color="bg-ink/40" n={counts.configured} label="configured" />
        <Pill color="bg-line" n={counts.unconfigured} label="not configured" />
        <Pill color="bg-line" n={counts.idle} label="not checked" />
        <span className="ml-auto flex items-center gap-3">
          {lastCheckAll && (
            <span className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">checked {fmtTime(lastCheckAll)}</span>
          )}
          <button
            className="btn-ink text-xs"
            onClick={() => {
              setCheckNonce((n) => n + 1);
              setLastCheckAll(Date.now());
            }}
          >
            Check all ({checkableCount})
          </button>
        </span>
      </div>

      {KINDS.map((kind) => {
        const group = rows.filter((r) => r.entry.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} className="mb-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">{KIND_LABEL[kind]}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.map((r) => (
                <SourceCard
                  key={r.entry.id}
                  entry={r.entry}
                  enabled={r.enabled}
                  liveCount={r.liveCount}
                  sample={r.sample}
                  checkNonce={checkNonce}
                  onStatus={onStatus}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
