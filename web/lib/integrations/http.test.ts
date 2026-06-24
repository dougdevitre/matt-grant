import { describe, it, expect, vi, afterEach } from "vitest";
import { mapLimit, requestWithRetry, fetchJsonWithRetry, fetchTextWithRetry } from "@/lib/integrations/http";

describe("mapLimit", () => {
  it("preserves input order and processes every item", async () => {
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("never runs more than `limit` tasks concurrently", async () => {
    let active = 0;
    let peak = 0;
    await mapLimit([...Array(12).keys()], 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // and it is actually concurrent
  });

  it("handles an empty list without spawning workers", async () => {
    expect(await mapLimit([], 4, async (x) => x)).toEqual([]);
  });

  it("passes the index to the mapper", async () => {
    const out = await mapLimit(["a", "b", "c"], 1, async (v, i) => `${i}:${v}`);
    expect(out).toEqual(["0:a", "1:b", "2:c"]);
  });
});

describe("requestWithRetry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries a 500 then returns the success response", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      return n === 1 ? new Response("err", { status: 500 }) : new Response("{}", { status: 200 });
    });
    const res = await requestWithRetry("http://x", { retries: 2 });
    expect(n).toBe(2);
    expect(res.status).toBe(200);
  });

  it("returns a 404 without throwing or retrying", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      return new Response("nope", { status: 404 });
    });
    const res = await requestWithRetry("http://x", { retries: 3 });
    expect(n).toBe(1);
    expect(res.status).toBe(404);
  });

  it("caps a huge Retry-After at the backoff ceiling (won't block past ~8s)", async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      vi.stubGlobal("fetch", async () => {
        n++;
        return n === 1
          ? new Response("slow down", { status: 503, headers: { "retry-after": "3600" } })
          : new Response("{}", { status: 200 });
      });
      const p = requestWithRetry("http://x", { retries: 2 });
      // Advancing only the 8s ceiling — NOT the 3600s the header asked for — must be
      // enough to fire the retry. If the wait weren't capped, the second fetch never
      // runs and this hangs.
      await vi.advanceTimersByTimeAsync(8000);
      const res = await p;
      expect(n).toBe(2);
      expect(res.status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends an object body as JSON with a content-type", async () => {
    let init: RequestInit | undefined;
    vi.stubGlobal("fetch", async (_url: unknown, i: RequestInit) => {
      init = i;
      return new Response("{}", { status: 200 });
    });
    await requestWithRetry("http://x", { body: { a: 1 } });
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
  });
});

describe("fetchJsonWithRetry / fetchTextWithRetry", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetchJsonWithRetry throws on a final non-ok status", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 404 }));
    await expect(fetchJsonWithRetry("http://x")).rejects.toThrow(/404/);
  });

  it("fetchTextWithRetry returns the body text", async () => {
    vi.stubGlobal("fetch", async () => new Response("hello world", { status: 200 }));
    expect(await fetchTextWithRetry("http://x")).toBe("hello world");
  });
});
