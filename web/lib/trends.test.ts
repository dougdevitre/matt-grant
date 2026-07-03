import { describe, it, expect } from "vitest";
import { bucketByDay, windowSums, deltaChip } from "./trends";

describe("bucketByDay", () => {
  const today = "2026-07-10";
  it("buckets events into trailing daily sums, oldest→newest", () => {
    const out = bucketByDay(
      [
        { at: "2026-07-10T09:00:00Z", value: 5 }, // today
        { at: "2026-07-10T20:00:00Z", value: 3 }, // today (same day → sums)
        { at: "2026-07-08T12:00:00Z", value: 2 }, // 2 days ago
      ],
      { days: 5, today },
    );
    // days: [7/6, 7/7, 7/8, 7/9, 7/10]
    expect(out).toEqual([0, 0, 2, 0, 8]);
  });

  it("drops events outside the window (older than days, and future)", () => {
    const out = bucketByDay(
      [
        { at: "2026-07-01T00:00:00Z", value: 99 }, // older than 5-day window
        { at: "2026-07-11T00:00:00Z", value: 77 }, // future
        { at: "2026-07-09T00:00:00Z", value: 4 },
      ],
      { days: 5, today },
    );
    expect(out.reduce((a, b) => a + b, 0)).toBe(4);
    expect(out[3]).toBe(4); // 7/9 is the 2nd-newest bucket
  });

  it("nets negative values (refunds) within a day", () => {
    const out = bucketByDay(
      [
        { at: "2026-07-10T09:00:00Z", value: 100 },
        { at: "2026-07-10T10:00:00Z", value: -30 },
      ],
      { days: 2, today },
    );
    expect(out[1]).toBe(70);
  });

  it("returns all-zero for an unparseable today or non-positive days", () => {
    expect(bucketByDay([{ at: "2026-07-10T00:00:00Z", value: 5 }], { days: 3, today: "nope" })).toEqual([0, 0, 0]);
    expect(bucketByDay([], { days: 0, today })).toEqual([]);
  });
});

describe("windowSums", () => {
  it("splits the tail into recent vs prior windows", () => {
    // 6 buckets, w=3 → recent = last 3, prior = first 3
    expect(windowSums([1, 2, 3, 4, 5, 6], 3)).toEqual({ recent: 15, prior: 6 });
  });
  it("clamps prior at the start of the series", () => {
    expect(windowSums([10, 20], 3)).toEqual({ recent: 30, prior: 0 });
  });
});

describe("deltaChip", () => {
  it("up + goodWhenUp = good; down = bad", () => {
    expect(deltaChip(10, 5, { label: "+5", goodWhenUp: true })).toEqual({ label: "+5", dir: "up", tone: "good" });
    expect(deltaChip(5, 10, { label: "-5", goodWhenUp: true })).toEqual({ label: "-5", dir: "down", tone: "bad" });
  });
  it("up is bad when goodWhenUp is false (e.g. spending)", () => {
    expect(deltaChip(10, 5, { label: "+5", goodWhenUp: false }).tone).toBe("bad");
  });
  it("no change is flat/neutral", () => {
    expect(deltaChip(7, 7, { label: "0", goodWhenUp: true })).toEqual({ label: "0", dir: "flat", tone: "neutral" });
  });
});
