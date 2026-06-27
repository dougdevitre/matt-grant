import { describe, it, expect } from "vitest";
import { campaignPhase, GOTV_WINDOW_DAYS } from "@/lib/campaign-phase";

const ELECTION = "2026-08-04T00:00:00-05:00";
const at = (iso: string) => new Date(iso).getTime();

describe("campaignPhase", () => {
  it("is 'campaign' well before the election", () => {
    const r = campaignPhase(at("2026-06-01T12:00:00-05:00"), ELECTION);
    expect(r.phase).toBe("campaign");
    expect(r.daysUntil).toBeGreaterThan(GOTV_WINDOW_DAYS);
  });

  it("is 'gotv' inside the final window", () => {
    const r = campaignPhase(at("2026-07-25T12:00:00-05:00"), ELECTION);
    expect(r.phase).toBe("gotv");
    expect(r.daysUntil).toBeLessThanOrEqual(GOTV_WINDOW_DAYS);
    expect(r.daysUntil).toBeGreaterThan(0);
  });

  it("is 'past' once election day has arrived/passed", () => {
    expect(campaignPhase(at("2026-08-04T09:00:00-05:00"), ELECTION).phase).toBe("past");
    expect(campaignPhase(at("2026-09-01T00:00:00-05:00"), ELECTION).phase).toBe("past");
  });

  it("rounds up so election-day morning still reads '1 day' the day before", () => {
    expect(campaignPhase(at("2026-08-03T06:00:00-05:00"), ELECTION).daysUntil).toBe(1);
  });
});
