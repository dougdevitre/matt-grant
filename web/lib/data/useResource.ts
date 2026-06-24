"use client";

// One client hook for fetching any source, replacing the hand-rolled tri-state
// (configured/products/busy) in components like PrintStudio. Native fetch +
// AbortController; no SWR/react-query dependency (keeps the lean-deps ethos).
//
// Accepts either a Resource envelope OR a bare payload (back-compat with the
// existing routes that return {...FeatureCollection, meta} or {configured,...}).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Provenance, type Resource } from "./resource";

export type ResourceUiState = "loading" | "ready" | "empty" | "error" | "degraded";

function isEmptyData(d: unknown): boolean {
  if (Array.isArray(d)) return d.length === 0;
  if (d && typeof d === "object" && "features" in d) {
    const f = (d as { features?: unknown[] }).features;
    return Array.isArray(f) && f.length === 0;
  }
  return d == null;
}

// Coerce any response into a Resource. Recognizes our envelope; otherwise wraps a
// bare payload, lifting a `.meta` block if the route already provides one.
function normalize<T>(json: unknown, httpOk: boolean): Resource<T> {
  if (json && typeof json === "object" && "ok" in json && "meta" in json) {
    return json as Resource<T>;
  }
  const obj = (json ?? {}) as { meta?: Provenance; error?: string };
  const meta: Provenance = obj.meta ?? { source: "unknown", kind: "api", live: httpOk };
  if (!httpOk) return { ok: false, data: null, meta: { ...meta, live: false }, error: obj.error ?? "request failed" };
  return { ok: true, data: json as T, meta };
}

export function useResource<T = unknown>(url: string, init?: { method?: string; body?: unknown }) {
  const [state, setState] = useState<ResourceUiState>("loading");
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<Provenance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable dependency key so an inline body object doesn't re-fire every render.
  const bodyKey = useMemo(() => (init?.body !== undefined ? JSON.stringify(init.body) : ""), [init?.body]);
  const method = init?.method;

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState("loading");
    setError(null);
    try {
      const res = await fetch(url, {
        method: method ?? (bodyKey ? "POST" : "GET"),
        headers: bodyKey ? { "content-type": "application/json" } : undefined,
        body: bodyKey || undefined,
        signal: ac.signal,
      });
      const json = await res.json().catch(() => null);
      const r = normalize<T>(json, res.ok);
      setData(r.data);
      setMeta(r.meta);
      if (!r.ok) {
        setError(r.error);
        setState("error");
      } else if (r.meta.degraded) {
        setState("degraded");
      } else if (isEmptyData(r.data)) {
        setState("empty");
      } else {
        setState("ready");
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError((err as Error)?.message ?? "request failed");
      setState("error");
    }
  }, [url, method, bodyKey]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { state, data, meta, error, reload: load };
}
