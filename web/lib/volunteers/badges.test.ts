import { describe, it, expect } from "vitest";
import { computeBadges, earnedBadges, TOTAL_BADGES, type BadgeContext } from "./badges";
import { scoreCaptain, type CaptainSignals } from "./score";

const sig = (over: Partial<CaptainSignals>): CaptainSignals => ({
  rosterSize: 0, contactable: 0, activated: 0, engaged: 0, recentEvents: 0, hasRegion: false, ...over,
});
const ctx = (over: Partial<CaptainSignals>, rank = 2, totalCaptains = 5): BadgeContext => ({
  score: scoreCaptain(sig(over)),
  rank,
  totalCaptains,
});

describe("computeBadges", () => {
  it("a brand-new captain has earned nothing", () => {
    const badges = computeBadges(ctx({}));
    expect(badges).toHaveLength(TOTAL_BADGES);
    expect(badges.every((b) => !b.earned_)).toBe(true);
  });

  it("awards the foundational badges from real signals", () => {
    const earned = earnedBadges(ctx({ rosterSize: 7, contactable: 7, engaged: 7, activated: 6, recentEvents: 1, hasRegion: true }));
    const ids = earned.map((b) => b.id);
    expect(ids).toContain("on-the-map");
    expect(ids).toContain("healthy-team");
    expect(ids).toContain("no-one-cold");
    expect(ids).toContain("activator");
    expect(ids).toContain("boots-on-ground");
    expect(ids).toContain("excellent");
  });

  it("top-captain is only for rank 1 with real activity", () => {
    const strong = sig({ rosterSize: 7, contactable: 7, engaged: 7, activated: 7, recentEvents: 1, hasRegion: true });
    expect(earnedBadges({ score: scoreCaptain(strong), rank: 1, totalCaptains: 5 }).map((b) => b.id)).toContain("top-captain");
    expect(earnedBadges({ score: scoreCaptain(strong), rank: 2, totalCaptains: 5 }).map((b) => b.id)).not.toContain("top-captain");
    // rank 1 but no activity → no trophy
    expect(earnedBadges({ score: scoreCaptain(sig({})), rank: 1, totalCaptains: 1 }).map((b) => b.id)).not.toContain("top-captain");
  });

  it("activator needs a solid active share (>=70), not just one active volunteer", () => {
    expect(earnedBadges(ctx({ rosterSize: 10, contactable: 10, activated: 5 })).map((b) => b.id)).not.toContain("activator");
    expect(earnedBadges(ctx({ rosterSize: 10, contactable: 10, activated: 7 })).map((b) => b.id)).toContain("activator");
  });

  it("locked badges still carry an honest how-to", () => {
    const badges = computeBadges(ctx({}));
    for (const b of badges) expect(b.howTo.length).toBeGreaterThan(0);
  });
});
