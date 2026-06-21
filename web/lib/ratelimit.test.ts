import { describe, it, expect } from "vitest";
import { windowStart, clientIp } from "@/lib/ratelimit";

describe("windowStart", () => {
  it("buckets timestamps to the start of their fixed window (unix seconds)", () => {
    // 60s windows: 00:00:00..00:00:59 → 0; 00:01:00 → 60
    expect(windowStart(0, 60)).toBe(0);
    expect(windowStart(59_999, 60)).toBe(0);
    expect(windowStart(60_000, 60)).toBe(60);
    expect(windowStart(119_999, 60)).toBe(60);
  });

  it("two times in the same window share a bucket; the next window differs", () => {
    // 1_000_000ms = 1000s, whose 60s window is [960s, 1020s).
    const a = windowStart(1_000_000, 60); // 960
    const b = windowStart(1_010_000, 60); // 1010s → still 960
    const c = windowStart(1_021_000, 60); // 1021s → 1020
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it("honors the window size", () => {
    expect(windowStart(5_000, 10)).toBe(0); // 5s into a 10s window
    expect(windowStart(11_000, 10)).toBe(10);
    expect(windowStart(601_000, 300)).toBe(600); // 5-min windows
  });
});

describe("clientIp", () => {
  const reqWith = (headers: Record<string, string>) => new Request("https://x.test", { headers });

  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "203.0.113.7, 70.0.0.1, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("trims whitespace around the client IP", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "  198.51.100.4  , 10.0.0.1" }))).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(clientIp(reqWith({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
    expect(clientIp(reqWith({}))).toBe("unknown");
  });
});
