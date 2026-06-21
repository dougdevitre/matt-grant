// Data-freshness signal for the research field engine.
//
// The ingest "run record" is written ok:false at start and only flipped ok:true
// at the end — so a heavy run that exceeds the Lambda window leaves the latest
// record looking FAILED even though every enrichment step persisted its data
// fine. That makes the run record an unreliable freshness indicator.
//
// Instead we derive freshness from the data ITSELF: each stored enrichment
// carries a retrievedAt/updatedAt written the moment it lands, independent of
// whether the run's end-record ever wrote. The most recent such timestamp is the
// true "data as of" — and if even the daily/weekly crons haven't refreshed
// anything in over a week, the pipeline is dead and we flag it stale.

export type Freshness = { latestAt: string | null; ageMs: number | null; stale: boolean };

const DEFAULT_STALE_MS = Number(process.env.RESEARCH_STALE_DAYS ?? "8") * 24 * 3600 * 1000;

// Pure core: the most recent valid timestamp across the inputs, and whether it's
// older than the stale threshold. No data at all → stale (nothing has ingested).
export function computeFreshness(
  timestamps: Array<string | null | undefined>,
  opts: { staleAfterMs?: number; now?: number } = {},
): Freshness {
  const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_MS;
  const now = opts.now ?? Date.now();
  const valid = timestamps
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .map((t) => Date.parse(t))
    .filter((n) => Number.isFinite(n));
  if (!valid.length) return { latestAt: null, ageMs: null, stale: true };
  const max = Math.max(...valid);
  const ageMs = now - max;
  return { latestAt: new Date(max).toISOString(), ageMs, stale: ageMs > staleAfterMs };
}

type Dated = { retrievedAt?: string; updatedAt?: string };

// Gather the per-step timestamps already carried by the loaded data maps (the
// overview loads these anyway, so this is free there) plus the run record's own
// time, and reduce to a single Freshness.
export function fieldFreshness(
  maps: {
    detail?: Record<string, Dated>;
    news?: Record<string, Dated>;
    fec?: Record<string, Dated>;
    runAt?: string | null;
  },
  opts: { staleAfterMs?: number; now?: number } = {},
): Freshness {
  const ts: Array<string | null | undefined> = [maps.runAt];
  for (const m of [maps.detail, maps.news, maps.fec]) {
    for (const row of Object.values(m ?? {})) ts.push(row.retrievedAt ?? row.updatedAt);
  }
  return computeFreshness(ts, opts);
}
