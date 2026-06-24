// Shared HTTP helper for external integration clients (FEC, Congress.gov, …).
//
// Two protections the raw fetch calls lacked:
//   • a hard timeout — a hung upstream socket otherwise rides the route's
//     maxDuration (300s) to a gateway 502 and, on a render path, stalls the user.
//   • bounded retry on transient/rate-limit responses (429/503/5xx) honoring
//     Retry-After — these public APIs (esp. the FEC DEMO_KEY) throttle readily.

type FetchJsonOpts = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  label?: string;
  /** HTTP method (default GET). */
  method?: string;
  /** Request body — an object is JSON-stringified with a default content-type. */
  body?: string | object;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_BACKOFF_MS = 8000; // ceiling for both exponential backoff and a server Retry-After

function backoffMs(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 500 * 2 ** (attempt - 1));
  return base + Math.floor(Math.random() * 250); // jitter
}

// Run an async fn over items with a bounded number in flight. Keeps an ingest
// fan-out from firing dozens of concurrent upstream calls (e.g. FEC, which
// throttles a low-rate DEMO_KEY immediately). Results preserve input order.
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, worker));
  return results;
}

/**
 * Core transport: a single request with hard timeout + bounded retry on transient
 * failures (network error / 429 / 5xx, honoring Retry-After). Returns the final
 * Response WITHOUT throwing on HTTP status — callers decide what a non-ok status
 * means (e.g. ClerkVotes treats 404 as a genuine gap, not an error). Throws only
 * on a network/timeout failure that survives all retries.
 */
export async function requestWithRetry(url: string | URL, opts: FetchJsonOpts = {}): Promise<Response> {
  const { headers, timeoutMs = 15000, retries = 3, label = "fetch", method, body } = opts;
  const isObjectBody = body != null && typeof body === "object";
  const init: RequestInit = {
    method: method ?? (body != null ? "POST" : "GET"),
    headers: isObjectBody ? { "content-type": "application/json", ...headers } : headers,
    body: isObjectBody ? JSON.stringify(body) : (body as string | undefined),
  };
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      // Network failure or timeout (AbortError / TimeoutError).
      if (attempt++ < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`${label}: ${(err as Error)?.name ?? "fetch failed"} after ${retries} retries`);
    }
    if ((res.status === 429 || res.status >= 500) && attempt++ < retries) {
      // Honor a numeric Retry-After, but CAP it at MAX_BACKOFF_MS — an upstream
      // (or a bad gateway) sending "Retry-After: 3600" must not block the request
      // for an hour and ride the route's maxDuration to a 502, the very hang this
      // transport exists to prevent. (HTTP-date Retry-After → NaN → backoff.)
      const ra = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, MAX_BACKOFF_MS) : backoffMs(attempt);
      await sleep(wait);
      continue;
    }
    return res;
  }
}

/** Retry + timeout, then parse JSON. Throws on a non-ok status (after retries). */
export async function fetchJsonWithRetry<T = unknown>(url: string | URL, opts: FetchJsonOpts = {}): Promise<T> {
  const res = await requestWithRetry(url, opts);
  if (!res.ok) throw new Error(`${opts.label ?? "fetch"} ${res.status}`);
  return (await res.json()) as T;
}

/** Retry + timeout, then return the body text. Throws on a non-ok status (after retries). */
export async function fetchTextWithRetry(url: string | URL, opts: FetchJsonOpts = {}): Promise<string> {
  const res = await requestWithRetry(url, opts);
  if (!res.ok) throw new Error(`${opts.label ?? "fetch"} ${res.status}`);
  return res.text();
}
