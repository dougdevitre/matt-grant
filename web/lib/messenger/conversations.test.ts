import { describe, it, expect } from "vitest";
import { canReplyNow, convoKey, parseKey, isMetaPlatform, REPLY_WINDOW_MS } from "./conversations";

describe("convoKey / parseKey", () => {
  it("round-trips a platform + psid, tolerating numeric ids", () => {
    expect(convoKey("messenger", "123")).toBe("messenger:123");
    expect(parseKey("messenger:123")).toEqual({ platform: "messenger", psid: "123" });
    expect(parseKey("instagram:987654321")).toEqual({ platform: "instagram", psid: "987654321" });
  });
  it("rejects malformed or unknown-platform keys", () => {
    expect(parseKey("nope")).toBeNull();
    expect(parseKey("whatsapp:1")).toBeNull();
    expect(parseKey("messenger:")).toBeNull();
    expect(isMetaPlatform("messenger")).toBe(true);
    expect(isMetaPlatform("sms")).toBe(false);
  });
});

describe("canReplyNow (Meta 24h standard-messaging window)", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("blocks a blocked sender regardless of window", () => {
    const d = canReplyNow({ blocked: true, lastInboundAt: ago(60_000) }, now);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/blocked/i);
  });

  it("refuses when they never messaged us", () => {
    expect(canReplyNow({ blocked: false }, now).allowed).toBe(false);
  });

  it("allows a reply inside the 24h window and reports when it ends", () => {
    // Last inbound was (WINDOW - 60s) ago, so the window closes 60s from now.
    const d = canReplyNow({ blocked: false, lastInboundAt: ago(REPLY_WINDOW_MS - 60_000) }, now);
    expect(d.allowed).toBe(true);
    expect(d.windowEndsAt).toBe(new Date(now.getTime() + 60_000).toISOString());
  });

  it("refuses once the window has closed", () => {
    const d = canReplyNow({ blocked: false, lastInboundAt: ago(REPLY_WINDOW_MS + 1) }, now);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/24-hour/i);
  });

  it("refuses on an unparseable timestamp", () => {
    expect(canReplyNow({ blocked: false, lastInboundAt: "not-a-date" }, now).allowed).toBe(false);
  });
});
