// One envelope every data loader returns, so a CSV manifest, a live API call, and
// an ArcGIS layer all hand back the same shape. This is the seam that makes the
// three retrieval paths (csv / api / geo) feel identical to callers and to the UI.
//
// Generalizes the three shapes that exist in the app today:
//   • Walgreens routes: { configured: false }            → meta.degraded
//   • geo routes:       { ...FeatureCollection, meta }    → { data: FeatureCollection, meta }
//   • research routes:  { ok, count, results }            → { ok, data, meta.count }

export type SourceKind = "csv" | "api" | "geo" | "airtable";

export type Provenance = {
  /** Human label for where the data came from, e.g. "candidate/letters/print-tracker.csv" or "OpenFEC". */
  source: string;
  kind: SourceKind;
  /** false = the caller is looking at a fallback (sample/empty) rather than live data. */
  live: boolean;
  /** ISO timestamp. Passed in by the caller — build scripts must stay deterministic (no Date.now in generators). */
  fetchedAt?: string;
  count?: number;
  note?: string;
  /** Set when the source could not be reached but the app still renders something usable. */
  degraded?: { reason: string };
};

export type Resource<T> =
  | { ok: true; data: T; meta: Provenance }
  | { ok: false; data: null; meta: Provenance; error: string };

/** A successful resource. */
export function ok<T>(data: T, meta: Provenance): Resource<T> {
  return { ok: true, data, meta };
}

/** A hard failure — nothing usable to show. */
export function fail(error: string, meta: Provenance): Resource<never> {
  return { ok: false, data: null, meta: { ...meta, live: false }, error };
}

/**
 * A degraded-but-usable resource: the live source was unavailable (missing
 * credentials, upstream error) but we have fallback data to render. Stays `ok`
 * so the UI shows the data with a notice rather than an error screen.
 */
export function degraded<T>(data: T, reason: string, meta: Provenance): Resource<T> {
  return { ok: true, data, meta: { ...meta, live: false, degraded: { reason } } };
}

/** Discriminator helpers for components choosing which state to render. */
export function isDegraded<T>(r: Resource<T>): boolean {
  return r.ok && !!r.meta.degraded;
}

/** True when the resource is ok but carries no rows (empty manifest / empty
 *  FeatureCollection / a record envelope reporting `count: 0`). */
export function isEmpty<T>(r: Resource<T>): boolean {
  if (!r.ok) return false;
  return isEmptyData(r.data as unknown);
}

/** Shared emptiness test over a raw payload: an empty array, an empty
 *  FeatureCollection, or an object whose own `count` is 0 (research/CHILD-Act
 *  envelopes shaped `{ count, bills }` — an array check alone misses these). */
export function isEmptyData(d: unknown): boolean {
  if (Array.isArray(d)) return d.length === 0;
  if (d && typeof d === "object") {
    if ("features" in d) {
      const f = (d as { features?: unknown[] }).features;
      return Array.isArray(f) && f.length === 0;
    }
    if (typeof (d as { count?: unknown }).count === "number") {
      return (d as { count: number }).count === 0;
    }
  }
  return d == null;
}
