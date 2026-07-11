import { describe, expect, it } from "vitest";
import { activeContactRound, CONTACT_SCHEDULE, daysUntil, GOTV_TIMELINE, KEY_DATES, timelineStatus } from "./warRoom";

describe("daysUntil", () => {
  it("counts calendar days, crossing month boundaries", () => {
    expect(daysUntil("2026-08-04", "2026-08-04")).toBe(0);
    expect(daysUntil("2026-08-04", "2026-08-03")).toBe(1);
    expect(daysUntil("2026-08-04", "2026-07-11")).toBe(24);
    expect(daysUntil(KEY_DATES.earlyVoteStart, "2026-07-11")).toBe(10);
    expect(daysUntil("2026-08-04", "2026-08-05")).toBe(-1); // past
  });
});

describe("timelineStatus", () => {
  const row = (label: string) => GOTV_TIMELINE.findIndex((r) => r.when === label);

  it("marks the current window and everything before it done", () => {
    const at24 = timelineStatus(24); // 24 days out → "4 weeks out" window (42-15)
    expect(at24[row("6-8 weeks out")]).toBe("done");
    expect(at24[row("4 weeks out")]).toBe("current");
    expect(at24[row("2 weeks out")]).toBe("upcoming");
    expect(at24[row("Election day")]).toBe("upcoming");
  });

  it("handles the boundaries: 4 days out starts the contact schedule; day 0 is election day", () => {
    expect(timelineStatus(4)[row("4 days out")]).toBe("current");
    expect(timelineStatus(5)[row("4 days out")]).toBe("upcoming");
    expect(timelineStatus(0)[row("Election day")]).toBe("current");
    expect(timelineStatus(0)[row("4 days out")]).toBe("done");
  });
});

describe("activeContactRound", () => {
  it("is null outside the final-4-days window and matches rounds inside it", () => {
    expect(activeContactRound(5)).toBeNull();
    expect(activeContactRound(-1)).toBeNull();
    expect(activeContactRound(4)?.contact).toBe("First GOTV contact");
    expect(activeContactRound(1)?.method).toBe("Phone, text, and/or door");
    expect(activeContactRound(0)?.contact).toBe("Election day chase");
  });

  it("keeps one row per day 4..0 (the doc's table, complete)", () => {
    expect(CONTACT_SCHEDULE.map((r) => r.daysOut)).toEqual([4, 3, 2, 1, 0]);
  });
});
