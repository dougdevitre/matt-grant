import { describe, it, expect } from "vitest";
import { estimateDrainCompletion, formatEtaCT, SMS_DRAIN_PER_MINUTE } from "./pacing";

// A weekday mid-morning CT anchor: 2026-07-23 is a Thursday; 15:00Z ≈ 10:00 CT (CDT, UTC-5),
// comfortably inside the 9am–8pm CT send window.
const inWindow = new Date("2026-07-23T15:00:00.000Z");

describe("estimateDrainCompletion", () => {
  it("nothing remaining → eta is now, no sending", () => {
    const e = estimateDrainCompletion(0, inWindow);
    expect(e.sendMinutes).toBe(0);
    expect(e.eta.getTime()).toBe(inWindow.getTime());
    expect(e.spansWindows).toBe(false);
  });

  it("a small blast finishes within the current window (minutes, not days)", () => {
    // At the default ~30/min, 300 texts ≈ 10 minutes of sending.
    const e = estimateDrainCompletion(300, inWindow, 30);
    expect(e.sendMinutes).toBe(10);
    expect(e.eta.getTime()).toBe(inWindow.getTime() + 10 * 60000);
    expect(e.spansWindows).toBe(false);
  });

  it("sendMinutes = ceil(remaining / perMinute)", () => {
    expect(estimateDrainCompletion(31, inWindow, 30).sendMinutes).toBe(2);
    expect(estimateDrainCompletion(30, inWindow, 30).sendMinutes).toBe(1);
  });

  it("a huge blast spans past the window and lands on a later day", () => {
    // 30/min × 660 in-window min/day ≈ 19,800/day; 50,000 needs multiple days.
    const e = estimateDrainCompletion(50_000, inWindow, 30);
    expect(e.spansWindows).toBe(true);
    expect(e.eta.getTime()).toBeGreaterThan(inWindow.getTime() + 24 * 60 * 60000);
    // The completion moment itself must fall inside the CT send window (9–20).
    const ctHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hour12: false }).format(e.eta),
    ) % 24;
    expect(ctHour).toBeGreaterThanOrEqual(9);
    expect(ctHour).toBeLessThan(20);
  });

  it("started before the window opens → waits for 9am CT before sending", () => {
    // 2026-07-23T09:00Z ≈ 04:00 CT — before the window. A 30-text (1-min) send should
    // finish shortly after 9am CT, not at 4:01am.
    const preDawn = new Date("2026-07-23T09:00:00.000Z");
    const e = estimateDrainCompletion(30, preDawn, 30);
    const ctHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hour12: false }).format(e.eta),
    ) % 24;
    expect(ctHour).toBeGreaterThanOrEqual(9);
    expect(ctHour).toBeLessThan(20);
  });

  it("exposes a sane default throughput", () => {
    expect(SMS_DRAIN_PER_MINUTE).toBeGreaterThan(0);
  });
});

describe("formatEtaCT", () => {
  it("renders a CT-labeled weekday time", () => {
    const s = formatEtaCT(inWindow);
    expect(s).toMatch(/CT$/);
    expect(s).toMatch(/Thu/);
  });
});
