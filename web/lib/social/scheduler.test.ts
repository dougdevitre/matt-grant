import { describe, it, expect } from "vitest";
import { parseClock, centralToUtcISO, combinedBestTimes, planSlots } from "@/lib/social/scheduler";

describe("parseClock", () => {
  it("parses 12h times to 24h", () => {
    expect(parseClock("8:00 AM")).toEqual({ hour: 8, minute: 0 });
    expect(parseClock("12:00 PM")).toEqual({ hour: 12, minute: 0 });
    expect(parseClock("5:30 PM")).toEqual({ hour: 17, minute: 30 });
    expect(parseClock("12:00 AM")).toEqual({ hour: 0, minute: 0 });
  });
});

describe("centralToUtcISO", () => {
  it("maps an August (CDT, UTC-5) Central morning to the right UTC instant", () => {
    // Aug 4 2026 08:00 America/Chicago = 13:00 UTC.
    expect(centralToUtcISO(2026, 7, 4, 8, 0)).toBe("2026-08-04T13:00:00.000Z");
  });
  it("maps a January (CST, UTC-6) Central morning correctly", () => {
    // Jan 4 2026 08:00 America/Chicago = 14:00 UTC.
    expect(centralToUtcISO(2026, 0, 4, 8, 0)).toBe("2026-01-04T14:00:00.000Z");
  });
});

describe("combinedBestTimes", () => {
  it("unions channel windows and sorts by time of day", () => {
    const times = combinedBestTimes(["x", "instagram"]);
    expect(times[0]).toBe("8:00 AM");
    expect(times).toContain("8:00 PM");
    // strictly ascending by time of day (not lexicographic)
    const mins = times.map((t) => {
      const { hour, minute } = parseClock(t);
      return hour * 60 + minute;
    });
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
});

describe("planSlots", () => {
  it("returns the requested count of future, ascending UTC instants", () => {
    const from = "2026-07-01T12:00:00.000Z";
    const slots = planSlots(["x"], 5, from);
    expect(slots).toHaveLength(5);
    for (const s of slots) expect(new Date(s).getTime()).toBeGreaterThan(new Date(from).getTime());
    const sorted = [...slots].sort();
    expect(slots).toEqual(sorted);
  });

  it("never schedules in the past", () => {
    const from = new Date().toISOString();
    const slots = planSlots(["x", "facebook", "instagram"], 7, from);
    for (const s of slots) expect(new Date(s).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});
