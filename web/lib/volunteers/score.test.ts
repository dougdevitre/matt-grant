import { describe, it, expect } from "vitest";
import { scoreCaptain, spanScore, SPAN_MIN, SPAN_MAX, type CaptainSignals } from "./score";

const base: CaptainSignals = {
  rosterSize: 0,
  contactable: 0,
  activated: 0,
  engaged: 0,
  recentEvents: 0,
  hasRegion: false,
};
const sig = (over: Partial<CaptainSignals>): CaptainSignals => ({ ...base, ...over });

describe("spanScore", () => {
  it("is 0 with no team", () => expect(spanScore(0)).toBe(0));
  it("ramps below the healthy band", () => {
    expect(spanScore(1)).toBe(20);
    expect(spanScore(4)).toBe(80);
  });
  it("is 100 across the 5–10 band", () => {
    for (let n = SPAN_MIN; n <= SPAN_MAX; n++) expect(spanScore(n)).toBe(100);
  });
  it("eases down over the band but never below 40", () => {
    expect(spanScore(11)).toBe(90);
    expect(spanScore(16)).toBe(40);
    expect(spanScore(40)).toBe(40);
  });
});

describe("scoreCaptain", () => {
  it("a brand-new captain has no activity and the 'new' tier", () => {
    const r = scoreCaptain(base);
    expect(r.hasActivity).toBe(false);
    expect(r.tier).toBe("new");
    expect(r.weakest).toBeNull();
    expect(r.total).toBe(0);
  });

  it("rewards a healthy, engaged team over a big dormant one (quality > volume)", () => {
    const quality = scoreCaptain(sig({ rosterSize: 7, contactable: 7, activated: 6, engaged: 7, recentEvents: 1, hasRegion: true }));
    const volume = scoreCaptain(sig({ rosterSize: 50, contactable: 50, activated: 2, engaged: 5, recentEvents: 0, hasRegion: true }));
    expect(quality.total).toBeGreaterThan(volume.total);
    expect(quality.tier).toBe("excellent");
  });

  it("never credits opted-out volunteers: they're outside contactable", () => {
    // 10 on roster, 4 opted out → contactable 6; all 6 engaged & active.
    const r = scoreCaptain(sig({ rosterSize: 10, contactable: 6, activated: 6, engaged: 6, recentEvents: 1, hasRegion: true }));
    expect(r.components.find((c) => c.key === "engaged")!.score).toBe(100);
    expect(r.components.find((c) => c.key === "activated")!.score).toBe(100);
  });

  it("engagement and activation are rates of the contactable team", () => {
    const r = scoreCaptain(sig({ rosterSize: 8, contactable: 8, activated: 2, engaged: 4 }));
    expect(r.components.find((c) => c.key === "engaged")!.score).toBe(50);
    expect(r.components.find((c) => c.key === "activated")!.score).toBe(25);
  });

  it("event credit is binary — more events don't inflate the score", () => {
    const one = scoreCaptain(sig({ rosterSize: 6, contactable: 6, engaged: 6, activated: 6, recentEvents: 1, hasRegion: true }));
    const five = scoreCaptain(sig({ rosterSize: 6, contactable: 6, engaged: 6, activated: 6, recentEvents: 5, hasRegion: true }));
    expect(one.total).toBe(five.total);
  });

  it("weights sum to 1 and total is the weighted sum", () => {
    const r = scoreCaptain(sig({ rosterSize: 7, contactable: 7, activated: 7, engaged: 7, recentEvents: 1, hasRegion: true }));
    const w = r.components.reduce((s, c) => s + c.weight, 0);
    expect(w).toBeCloseTo(1, 5);
    expect(r.total).toBe(100); // all components maxed
  });

  it("surfaces the weakest component as the next action", () => {
    // strong everywhere except no region
    const r = scoreCaptain(sig({ rosterSize: 7, contactable: 7, activated: 7, engaged: 7, recentEvents: 1, hasRegion: false }));
    expect(r.weakest).toBe("region");
  });

  it("ties on weakest break toward the higher-weight (more impactful) fix", () => {
    // engaged (0.30) and events(0.15) both 0; engaged should win the tie.
    const r = scoreCaptain(sig({ rosterSize: 7, contactable: 7, activated: 7, engaged: 0, recentEvents: 0, hasRegion: true }));
    expect(r.weakest).toBe("engaged");
  });
});
