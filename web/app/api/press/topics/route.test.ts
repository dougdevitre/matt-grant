import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the rate limiter so we can drive the over-limit branch deterministically
// without DynamoDB. clientIp stays trivial — the key string doesn't matter here.
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit,
  clientIp: () => "203.0.113.1",
}));

import { POST } from "./route";
import { PRESS_TOPICS } from "@/lib/pressTopics";

const reqWith = (body: unknown) =>
  new Request("https://x.test/api/press/topics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("POST /api/press/topics rate limiting", () => {
  it("over the limit, degrades to the curated set and never calls the model", async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 11, limit: 10, resetAt: 0 });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await POST(reqWith({ focus: "schools", outlet: "Post-Dispatch" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.source).toBe("curated");
    expect(json.clusters).toHaveLength(PRESS_TOPICS.length);
    // The whole point of the gate: no paid Ai call once throttled.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("checks the limit before doing any work (gate runs even on an empty body)", async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 99, limit: 10, resetAt: 0 });
    const res = await POST(reqWith(null));
    expect((await res.json()).source).toBe("curated");
    expect(rateLimit).toHaveBeenCalledOnce();
  });
});
