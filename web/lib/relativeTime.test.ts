import { describe, it, expect } from "vitest";
import { relTime, isStale } from "./relativeTime";

const NOW = new Date("2026-07-23T12:00:00.000Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relTime", () => {
  it("null / invalid → 'never'", () => {
    expect(relTime(null, { now: NOW })).toBe("never");
    expect(relTime(undefined, { now: NOW })).toBe("never");
    expect(relTime("not-a-date", { now: NOW })).toBe("never");
  });

  it("under a minute → 'just now'", () => {
    expect(relTime(ago(30_000), { now: NOW })).toBe("just now");
  });

  it("minutes and hours buckets", () => {
    expect(relTime(ago(5 * MIN), { now: NOW })).toBe("5m ago");
    expect(relTime(ago(3 * HOUR), { now: NOW })).toBe("3h ago");
    expect(relTime(ago(23 * HOUR), { now: NOW })).toBe("23h ago");
  });

  it("days bucket up to a week", () => {
    expect(relTime(ago(2 * DAY), { now: NOW })).toBe("2d ago");
    expect(relTime(ago(7 * DAY), { now: NOW })).toBe("7d ago");
  });

  it("past a week → a short date, not a relative string", () => {
    const s = relTime(ago(30 * DAY), { now: NOW });
    expect(s).not.toMatch(/ago|never/);
    expect(s).toMatch(/[A-Z][a-z]{2} \d/); // e.g. "Jun 23"
  });

  it("a future timestamp clamps to 'just now' (never negative)", () => {
    expect(relTime(new Date(NOW + HOUR).toISOString(), { now: NOW })).toBe("just now");
  });
});

describe("isStale", () => {
  it("null / never counts as stale", () => {
    expect(isStale(null, 48, { now: NOW })).toBe(true);
  });
  it("fresh within the window is not stale", () => {
    expect(isStale(ago(3 * HOUR), 48, { now: NOW })).toBe(false);
  });
  it("older than the window is stale", () => {
    expect(isStale(ago(3 * DAY), 48, { now: NOW })).toBe(true);
  });
});
