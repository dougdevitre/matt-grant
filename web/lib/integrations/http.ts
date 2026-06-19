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
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number): number {
  const base = Math.min(8000, 500 * 2 ** (attempt - 1));
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

export async function fetchJsonWithRetry<T = unknown>(url: string | URL, opts: FetchJsonOpts = {}): Promise<T> {
  const { headers, timeoutMs = 15000, retries = 3, label = "fetch" } = opts;
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      // Network failure or timeout (AbortError / TimeoutError).
      if (attempt++ < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`${label}: ${(err as Error)?.name ?? "fetch failed"} after ${retries} retries`);
    }
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt++ < retries) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoffMs(attempt));
      continue;
    }
    throw new Error(`${label} ${res.status}`);
  }
}
