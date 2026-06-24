// Live-API loader that wraps the existing retry/timeout fetch wrapper in the
// Resource envelope. The seam Walgreens / Census / FEC / Congress routes can adopt
// so a missing credential becomes a *degraded* resource (render fallback + notice)
// and an upstream failure becomes a clean error — never a thrown 500.
import { z } from "zod";
import { fetchJsonWithRetry } from "@/lib/integrations/http";
import { type Resource, type Provenance, ok, fail, degraded } from "./resource";

export type LoadApiOpts<T> = {
  source: string;
  /** Pass an `enabled` flag (e.g. `walgreensEnabled`); false → degraded/fail without calling out. */
  enabled?: boolean;
  schema?: z.ZodType<T>;
  /** Usable data to show when the source is unavailable; presence flips failures to `degraded`. */
  fallback?: T;
  fetchedAt?: string;
};

function countOf(d: unknown): number | undefined {
  if (Array.isArray(d)) return d.length;
  if (d && typeof d === "object" && "features" in d && Array.isArray((d as { features: unknown[] }).features)) {
    return (d as { features: unknown[] }).features.length;
  }
  return undefined;
}

/**
 * Run `fetcher`, validate, and wrap in a Resource. `fetcher` is any async producing
 * the raw payload — typically a thin closure over `fetchJsonWithRetry` or a vendor
 * client like `wgPost`. Errors and `enabled:false` degrade gracefully.
 */
export async function loadApi<T>(fetcher: () => Promise<unknown>, opts: LoadApiOpts<T>): Promise<Resource<T>> {
  const base: Provenance = { source: opts.source, kind: "api", live: true, fetchedAt: opts.fetchedAt };
  const fallbackOr = (reason: string): Resource<T> =>
    opts.fallback !== undefined ? degraded(opts.fallback, reason, base) : fail(reason, base);

  if (opts.enabled === false) return fallbackOr("credentials not configured");

  let raw: unknown;
  try {
    raw = await fetcher();
  } catch (err) {
    return fallbackOr((err as Error)?.message ?? "request failed");
  }

  if (opts.schema) {
    const r = opts.schema.safeParse(raw);
    if (!r.success) return fallbackOr(`response failed validation: ${r.error.message}`);
    return ok(r.data, { ...base, count: countOf(r.data) });
  }
  return ok(raw as T, { ...base, count: countOf(raw) });
}

/** Convenience: a JSON fetcher (retry + timeout) ready to hand to `loadApi`. */
export function apiJson(url: string | URL, init?: { headers?: Record<string, string>; timeoutMs?: number; label?: string }) {
  return () => fetchJsonWithRetry<unknown>(url, init);
}
