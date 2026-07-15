// Ingest planning helpers — PURE + tested, so the ingest CLI stays thin glue
// (candidate/voter-file-plan.md §3). These decide whether a run is a no-op
// (idempotent re-load) and reconcile voter-count drift between loads. The main
// ingest recomputes ALL per-precinct aggregates in one pass and overwrites
// VOTERAGG wholesale, so resume is a WHOLE-RUN decision — skipping individual
// files would leave the rollups computed from only the files that were read.

export type ManifestFile = { file?: string; sha256?: string; rows?: number };
export type PriorRun = { SK?: string; files?: ManifestFile[]; voters?: number };
export type FileRef = { file: string; sha256: string };

/** The set of file content-hashes recorded by a single prior run. */
function runHashes(run: PriorRun): Set<string> {
  return new Set((run.files ?? []).map((f) => f.sha256).filter((h): h is string => !!h));
}

/**
 * The most recent prior run that already ingested EVERY current file (by content
 * hash), or null. When one exists and the operator didn't pass --force, the load
 * is a no-op: the identical data is already in the table. Runs are compared
 * newest-first by SK (ISO timestamp).
 */
export function runCoveringAll(priorRuns: PriorRun[], files: FileRef[]): PriorRun | null {
  const want = files.map((f) => f.sha256);
  if (!want.length) return null;
  const byNewest = [...priorRuns].sort((a, b) => String(b.SK ?? "").localeCompare(String(a.SK ?? "")));
  for (const run of byNewest) {
    const have = runHashes(run);
    if (want.every((h) => have.has(h))) return run;
  }
  return null;
}

export type ResumeDecision = { skip: boolean; coveredBy: PriorRun | null };

/** Whole-run resume decision: skip when a prior run already covers all files and
 *  the caller isn't forcing a reload. */
export function planResume(priorRuns: PriorRun[], files: FileRef[], force = false): ResumeDecision {
  if (force) return { skip: false, coveredBy: null };
  const coveredBy = runCoveringAll(priorRuns, files);
  return { skip: !!coveredBy, coveredBy };
}

export type CountReconciliation = { previous: number | null; current: number; delta: number | null };

/** Cheap drift signal from the last run's manifest count — no table scan. A
 *  positive delta = net new registrants since the last load; negative = net
 *  departures. `previous`/`delta` are null when there's no prior run to compare. */
export function reconcileCounts(priorRuns: PriorRun[], currentVoters: number): CountReconciliation {
  const byNewest = [...priorRuns].sort((a, b) => String(b.SK ?? "").localeCompare(String(a.SK ?? "")));
  const prev = byNewest.find((r) => typeof r.voters === "number");
  const previous = prev?.voters ?? null;
  return { previous, current: currentVoters, delta: previous == null ? null : currentVoters - previous };
}

/**
 * Voter IDs present in a previous load but absent now — departed registrants to
 * REPORT, never auto-delete (retention is the campaign's documented decision,
 * voter-file-plan.md §2.5). Pure; the caller supplies both ID sets.
 */
export function reconcileStale(previousIds: Iterable<string>, currentIds: Set<string>): string[] {
  const gone: string[] = [];
  for (const id of previousIds) if (!currentIds.has(id)) gone.push(id);
  return gone;
}
