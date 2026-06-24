// Shared loading / empty / error / degraded states so every data surface (CSV
// trackers, live-API panels, geo layers) looks and behaves the same. Styling
// mirrors the dashboard skeleton (app/dashboard/loading.tsx) and DbNotice
// (components/dashboard/Notice.tsx).
import type { Provenance } from "@/lib/data/resource";

export function Loading({ rows = 4, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div className="animate-pulse space-y-3 motion-reduce:animate-none" role="status" aria-label={label}>
      <div className="h-6 w-40 rounded bg-line" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-line/50" />
      ))}
    </div>
  );
}

export function Empty({ title = "Nothing here yet", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-line bg-paper/60 px-5 py-8 text-center text-sm text-slate">
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-prose">{children}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="rounded-sm border border-brick/40 bg-brick/5 px-5 py-4 text-sm text-ink">
      <p className="font-semibold text-brick">Couldn’t load this.</p>
      {error && <p className="mt-1 text-slate">{error}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-3 text-sm">
          Try again
        </button>
      )}
    </div>
  );
}

// Degraded = we’re showing fallback/sample data because the live source was
// unavailable (missing credential or upstream error). Same gold treatment as DbNotice.
export function DegradedNotice({ reason, source }: { reason?: string; source?: string }) {
  return (
    <div className="mb-4 rounded-sm border border-gold/50 bg-gold/10 px-5 py-3 text-sm text-ink">
      <p className="font-semibold">
        Showing fallback data{source ? ` for ${source}` : ""}.
      </p>
      {reason && <p className="mt-1 text-slate">{reason}</p>}
    </div>
  );
}

// One-line provenance chip (source · live/sample · count · as-of date) for cards and headers.
export function ProvenanceChip({ meta }: { meta: Provenance | null }) {
  if (!meta) return null;
  const live = meta.live && !meta.degraded;
  const asOf = meta.fetchedAt ? new Date(meta.fetchedAt) : null;
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${live ? "bg-field" : "bg-gold"}`}
        aria-hidden
      />
      {meta.source}
      {typeof meta.count === "number" && <span className="text-slate">· {meta.count}</span>}
      <span className="text-slate">· {live ? "live" : "sample"}</span>
      {asOf && !Number.isNaN(asOf.getTime()) && (
        <span className="text-slate">· as of {asOf.toLocaleDateString()}</span>
      )}
    </span>
  );
}
