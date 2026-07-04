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

  it("prefers cloudfront-viewer-address (edge-set, non-spoofable), stripping the :port", () => {
    // The real live shape: the app-visible XFF rightmost is a CloudFront hop, but
    // cloudfront-viewer-address holds the true client — it must win.
    expect(
      clientIp(reqWith({
        "cloudfront-viewer-address": "18.234.124.44:37192",
        "x-forwarded-for": "18.234.124.44, 64.252.66.122",
      })),
    ).toBe("18.234.124.44");
  });

  it("cannot be spoofed via x-forwarded-for when cloudfront-viewer-address is present", () => {
    expect(
      clientIp(reqWith({
        "cloudfront-viewer-address": "203.0.113.7:443",
        "x-forwarded-for": "9.9.9.9, 8.8.8.8", // attacker-controlled left entries
      })),
    ).toBe("203.0.113.7");
  });

  it("handles an IPv6 cloudfront-viewer-address (strip only the trailing :port)", () => {
    expect(clientIp(reqWith({ "cloudfront-viewer-address": "2600:1f18:abcd:1::5:52024" }))).toBe(
      "2600:1f18:abcd:1::5",
    );
    expect(clientIp(reqWith({ "cloudfront-viewer-address": "[2600:1f18::5]:443" }))).toBe("2600:1f18::5");
  });

  it("takes the last hop (the trusted proxy's appended client IP), ignoring spoofed leftmost entries", () => {
    // A client sends a fake leftmost value; CloudFront appends the real viewer IP last.
    expect(clientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
    // A single-entry chain is that entry.
    expect(clientIp(reqWith({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("honors RATELIMIT_TRUSTED_PROXY_HOPS for extra trusted internal hops", () => {
    const prev = process.env.RATELIMIT_TRUSTED_PROXY_HOPS;
    process.env.RATELIMIT_TRUSTED_PROXY_HOPS = "2";
    try {
      // spoofed, realClient, internalProxy → the real client is 2nd from the end.
      expect(clientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    } finally {
      if (prev === undefined) delete process.env.RATELIMIT_TRUSTED_PROXY_HOPS;
      else process.env.RATELIMIT_TRUSTED_PROXY_HOPS = prev;
    }
  });

  it("trims whitespace around the client IP", () => {
    expect(clientIp(reqWith({ "x-forwarded-for": "  9.9.9.9 , 198.51.100.4  " }))).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip, then to 'unknown'", () => {
    expect(clientIp(reqWith({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
    expect(clientIp(reqWith({}))).toBe("unknown");
  });
});
