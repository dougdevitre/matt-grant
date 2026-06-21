import { describe, it, expect } from "vitest";
import { computeFreshness, fieldFreshness } from "@/lib/integrations/research/freshness";

const DAY = 24 * 3600 * 1000;
const now = Date.parse("2026-06-21T00:00:00Z");

describe("computeFreshness", () => {
  it("picks the most recent timestamp as 'data as of'", () => {
    const r = computeFreshness(
      ["2026-06-10T00:00:00Z", "2026-06-20T00:00:00Z", "2026-06-15T00:00:00Z"],
      { now },
    );
    expect(r.latestAt).toBe("2026-06-20T00:00:00.000Z");
    expect(r.stale).toBe(false); // 1 day old < 8-day default
  });

  it("flags stale when the freshest data is older than the threshold", () => {
    const r = computeFreshness(["2026-06-01T00:00:00Z"], { now }); // 20 days old
    expect(r.stale).toBe(true);
    expect(r.ageMs).toBe(20 * DAY);
  });

  it("treats no data at all as stale", () => {
    expect(computeFreshness([], { now })).toEqual({ latestAt: null, ageMs: null, stale: true });
    expect(computeFreshness([null, undefined, ""], { now }).stale).toBe(true);
  });

  it("ignores unparseable timestamps", () => {
    const r = computeFreshness(["not-a-date", "2026-06-20T00:00:00Z", "also bad"], { now });
    expect(r.latestAt).toBe("2026-06-20T00:00:00.000Z");
  });

  it("honors a custom stale threshold", () => {
    const ts = ["2026-06-19T00:00:00Z"]; // 2 days old
    expect(computeFreshness(ts, { now, staleAfterMs: 3 * DAY }).stale).toBe(false);
    expect(computeFreshness(ts, { now, staleAfterMs: 1 * DAY }).stale).toBe(true);
  });
});

describe("fieldFreshness", () => {
  it("reduces retrievedAt/updatedAt across the loaded data maps + run time", () => {
    const r = fieldFreshness(
      {
        detail: { wagner: { retrievedAt: "2026-06-14T00:00:00Z" } },
        news: { wagner: { retrievedAt: "2026-06-20T12:00:00Z" }, vivio: { retrievedAt: "2026-06-19T00:00:00Z" } },
        runAt: "2026-06-01T00:00:00Z",
      },
      { now },
    );
    expect(r.latestAt).toBe("2026-06-20T12:00:00.000Z"); // freshest = news
    expect(r.stale).toBe(false);
  });

  it("falls back to updatedAt when retrievedAt is absent", () => {
    const r = fieldFreshness({ fec: { wagner: { updatedAt: "2026-06-20T00:00:00Z" } } }, { now });
    expect(r.latestAt).toBe("2026-06-20T00:00:00.000Z");
  });

  it("is stale when the maps are empty and there's no run", () => {
    expect(fieldFreshness({}, { now }).stale).toBe(true);
  });
});
