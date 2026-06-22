import { describe, it, expect } from "vitest";
import { scoreContent, analyzeChannel, footprintScore, type ChannelMetrics } from "@/lib/social/optimize";
import { composeText, toChannelIds } from "@/lib/social/channels";
import { rollUp } from "@/lib/social/schedule";
import { absoluteMediaUrl } from "@/lib/social/publish";

describe("scoreContent", () => {
  it("flags an over-limit X post as an error and counts how far over", () => {
    const s = scoreContent({ channel: "x", caption: "a".repeat(300), hashtags: [], hasMedia: true, cta: "Vote", hasDisclaimer: true });
    expect(s.overBy).toBeGreaterThan(0);
    expect(s.issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("requires the paid-for-by disclaimer", () => {
    const s = scoreContent({ channel: "instagram", caption: "Vote Aug 4", hashtags: ["#MO02"], hasMedia: true, cta: "Vote", hasDisclaimer: false });
    expect(s.issues.some((i) => /paid for by/i.test(i.message))).toBe(true);
  });

  it("warns when over the recommended hashtag range", () => {
    const tags = Array.from({ length: 6 }, (_, i) => `#t${i}`);
    const s = scoreContent({ channel: "x", caption: "Short", hashtags: tags, hasMedia: true, cta: "Vote", hasDisclaimer: true });
    // 6 > maxHashtags(5) for X → error
    expect(s.issues.some((i) => i.severity === "error" && /hashtag|max/i.test(i.message))).toBe(true);
  });

  it("rewards a clean, compliant post with a high score", () => {
    const s = scoreContent({ channel: "instagram", caption: "Putting Missouri's children first. Vote August 4.", hashtags: ["#MattGrant", "#MO02", "#ChildrenFirst"], hasMedia: true, cta: "Vote", hasDisclaimer: true });
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(s.overBy).toBe(0);
  });
});

describe("analyzeChannel", () => {
  const base: ChannelMetrics = {
    channel: "x",
    followers: 1000,
    posts30d: 30,
    impressions30d: 50000,
    engagements30d: 1500,
    profileVisits30d: 2000,
    linkClicks30d: 200,
    conversions30d: 10,
  };

  it("computes engagement, cadence, and conversion correctly", () => {
    const r = analyzeChannel(base);
    expect(r.engagementRate).toBeCloseTo(3.0, 1); // 1500/50000
    expect(r.cadencePerWeek).toBeCloseTo(7, 0); // 30/30*7
    expect(r.conversionRate).toBeCloseTo(5.0, 1); // 10/200
  });

  it("recommends posting more when cadence is low", () => {
    const r = analyzeChannel({ ...base, posts30d: 4 });
    expect(r.recommendations.some((x) => x.lever === "consistency")).toBe(true);
  });

  it("never divides by zero on an empty channel", () => {
    const r = analyzeChannel({ channel: "threads", followers: 0, posts30d: 0, impressions30d: 0, engagements30d: 0, profileVisits30d: 0, linkClicks30d: 0, conversions30d: 0 });
    expect(Number.isFinite(r.engagementRate)).toBe(true);
    expect(r.health).toBe(0);
  });
});

describe("footprintScore", () => {
  it("rewards broad coverage and penalizes presence gaps", () => {
    const strong: ChannelMetrics = { channel: "x", followers: 5000, posts30d: 30, impressions30d: 300000, engagements30d: 9000, profileVisits30d: 5000, linkClicks30d: 400, conversions30d: 20 };
    const one = footprintScore([strong]);
    const many = footprintScore([
      strong,
      { ...strong, channel: "facebook" },
      { ...strong, channel: "instagram" },
      { ...strong, channel: "linkedin" },
    ]);
    expect(many.index).toBeGreaterThan(one.index);
    expect(one.missingChannels.length).toBeGreaterThan(many.missingChannels.length);
  });

  it("ranks high-priority moves to the top", () => {
    const weak: ChannelMetrics = { channel: "x", followers: 1000, posts30d: 2, impressions30d: 1000, engagements30d: 5, profileVisits30d: 100, linkClicks30d: 1, conversions30d: 0 };
    const r = footprintScore([weak]);
    expect(r.topMoves[0]?.priority).toBe("high");
  });
});

describe("channel helpers", () => {
  it("maps legacy channel names to ids and de-dupes", () => {
    expect(toChannelIds(["X", "Facebook", "x", "bogus"])).toEqual(["x", "facebook"]);
  });

  it("appends a hashtag block only when tags exist", () => {
    expect(composeText("Hello", [])).toBe("Hello");
    expect(composeText("Hello", ["#MO02"])).toBe("Hello\n\n#MO02");
  });
});

describe("rollUp post status", () => {
  it("is posted only when every channel is posted", () => {
    expect(rollUp(["x", "facebook"], { x: { status: "posted", mode: "api" }, facebook: { status: "posted", mode: "manual" } })).toBe("posted");
  });
  it("awaits when any channel is still ready for a human", () => {
    expect(rollUp(["x", "facebook"], { x: { status: "posted", mode: "api" }, facebook: { status: "ready", mode: "manual" } })).toBe("awaiting");
  });
  it("is partial when some failed and none are pending/ready", () => {
    expect(rollUp(["x", "facebook"], { x: { status: "posted", mode: "api" }, facebook: { status: "failed", mode: "api" } })).toBe("partial");
  });
  it("is failed when all channels failed", () => {
    expect(rollUp(["x"], { x: { status: "failed", mode: "api" } })).toBe("failed");
  });
});

describe("absoluteMediaUrl (Meta needs a fetchable URL)", () => {
  it("makes a relative app URL absolute against the live site", () => {
    expect(absoluteMediaUrl("/api/graphics?format=ig_square")).toBe("https://mattgrantforcongress.org/api/graphics?format=ig_square");
  });
  it("passes absolute URLs through and drops anything else", () => {
    expect(absoluteMediaUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(absoluteMediaUrl(undefined)).toBeUndefined();
    expect(absoluteMediaUrl("data:image/png;base64,xxx")).toBeUndefined();
  });
});
