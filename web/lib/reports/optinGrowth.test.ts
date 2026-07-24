import { describe, it, expect } from "vitest";
import { optinGrowth, sourceLabel } from "./optinGrowth";
import type { SmsConsentRow } from "@/lib/sms/consent";

const NOW = new Date("2026-07-23T12:00:00.000Z").getTime();
// Build a valid UTC ISO timestamp for a given date + hour (default 10:00).
const day = (d: string, hh = "10") => `${d}T${hh}:00:00.000Z`;

const row = (o: Partial<SmsConsentRow>): SmsConsentRow => ({ phone: "+13145550000", status: "opted_in", ...o });

describe("sourceLabel", () => {
  it("maps known sources and passes through unknown ones", () => {
    expect(sourceLabel("winred")).toBe("WinRed donors");
    expect(sourceLabel("sms-keyword")).toBe("Text keyword");
    expect(sourceLabel("something-new")).toBe("something-new");
  });
});

describe("optinGrowth", () => {
  it("empty input → zeros and a zero-filled window", () => {
    const g = optinGrowth([], { now: NOW, days: 7 });
    expect(g.totals).toEqual({ optedIn: 0, optedOut: 0, sources: 0 });
    expect(g.bySource).toEqual([]);
    expect(g.byDay).toHaveLength(7);
    expect(g.byDay.every((d) => d.optIns === 0)).toBe(true);
    expect(g.recentOptIns).toBe(0);
  });

  it("counts opted-in vs opted-out; only opted-in feeds source/day breakdowns", () => {
    const g = optinGrowth(
      [
        row({ phone: "+1a", status: "opted_in", source: "winred", consentAt: day("2026-07-22") }),
        row({ phone: "+1b", status: "opted_in", source: "winred", consentAt: day("2026-07-23") }),
        row({ phone: "+1c", status: "opted_in", source: "join-form", consentAt: day("2026-07-23") }),
        row({ phone: "+1d", status: "opted_out", source: "winred", consentAt: day("2026-07-20") }),
      ],
      { now: NOW, days: 30 },
    );
    expect(g.totals).toEqual({ optedIn: 3, optedOut: 1, sources: 2 });
    expect(g.bySource[0]).toMatchObject({ source: "winred", count: 2 });
    expect(g.bySource[0].pct).toBeCloseTo((2 / 3) * 100, 5);
    expect(g.bySource[1]).toMatchObject({ source: "join-form", count: 1 });
  });

  it("ranks sources by count, ties broken by label", () => {
    const g = optinGrowth(
      [
        row({ phone: "+1a", source: "winred", consentAt: day("2026-07-23") }),
        row({ phone: "+1b", source: "join-form", consentAt: day("2026-07-23") }),
      ],
      { now: NOW },
    );
    // both count 1 → label order: "Join page" < "WinRed donors"
    expect(g.bySource.map((s) => s.source)).toEqual(["join-form", "winred"]);
  });

  it("blank/missing source becomes 'unknown', never dropped", () => {
    const g = optinGrowth([row({ phone: "+1a", source: "", consentAt: day("2026-07-23") })], { now: NOW });
    expect(g.bySource[0]).toMatchObject({ source: "unknown", count: 1 });
  });

  it("buckets consentAt by UTC day within the window; counts recent opt-ins", () => {
    const g = optinGrowth(
      [
        row({ phone: "+1a", consentAt: day("2026-07-23", "01") }),
        row({ phone: "+1b", consentAt: day("2026-07-23", "23") }),
        row({ phone: "+1c", consentAt: day("2026-07-21") }),
      ],
      { now: NOW, days: 7 },
    );
    const byDate = new Map(g.byDay.map((d) => [d.date, d.optIns]));
    expect(byDate.get("2026-07-23")).toBe(2);
    expect(byDate.get("2026-07-21")).toBe(1);
    expect(g.recentOptIns).toBe(3);
    expect(g.byDay[g.byDay.length - 1].date).toBe("2026-07-23"); // window ends today
  });

  it("excludes opt-ins older than the window from recentOptIns but still totals them", () => {
    const g = optinGrowth(
      [
        row({ phone: "+1a", consentAt: day("2026-07-23") }),
        row({ phone: "+1b", consentAt: day("2026-06-01") }), // older than a 7-day window
      ],
      { now: NOW, days: 7 },
    );
    expect(g.totals.optedIn).toBe(2);
    expect(g.recentOptIns).toBe(1);
  });

  it("tolerates a missing/invalid consentAt (counted in totals, not in any day)", () => {
    const g = optinGrowth(
      [
        row({ phone: "+1a", source: "winred" }), // no consentAt
        row({ phone: "+1b", source: "winred", consentAt: "not-a-date" }),
      ],
      { now: NOW, days: 7 },
    );
    expect(g.totals.optedIn).toBe(2);
    expect(g.recentOptIns).toBe(0);
    expect(g.bySource[0].count).toBe(2);
  });
});
