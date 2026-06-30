import { describe, it, expect, vi } from "vitest";

// captains.ts is server-only + reads the DB; neutralize so we can unit-test the
// PURE matcher (suggestCaptain / areaCovers).
vi.mock("server-only", () => ({}));
vi.mock("@/lib/staff", () => ({ listStaff: vi.fn() }));
vi.mock("@/lib/queries", () => ({ getVolunteers: vi.fn() }));

import { suggestCaptain, areaCovers, regionsCover, captainCovers, type Captain } from "./captains";

const cap = (over: Partial<Captain> = {}): Captain => ({
  email: "c@x.com", firstName: "C", teamSize: 0, ...over,
});

describe("areaCovers", () => {
  it("matches a ZIP inside the captain's area", () => {
    expect(areaCovers("63101, 63102 (downtown)", { zip: "63101" })).toBe(true);
  });
  it("matches a city case-insensitively", () => {
    expect(areaCovers("Kirkwood", { city: "kirkwood" })).toBe(true);
  });
  it("no area → no match", () => {
    expect(areaCovers(undefined, { zip: "63101" })).toBe(false);
  });
});

describe("regionsCover / captainCovers", () => {
  it("matches when any assigned region covers the volunteer", () => {
    expect(regionsCover(["St. Louis County", "Kirkwood"], { city: "kirkwood" })).toBe(true);
    expect(regionsCover(["St. Charles County"], { city: "kirkwood" })).toBe(false);
  });
  it("no regions → no match", () => {
    expect(regionsCover(undefined, { city: "kirkwood" })).toBe(false);
    expect(regionsCover([], { city: "kirkwood" })).toBe(false);
  });
  it("captainCovers prefers regions but falls back to legacy area", () => {
    expect(captainCovers({ regions: ["Kirkwood"], area: undefined }, { city: "kirkwood" })).toBe(true);
    expect(captainCovers({ regions: undefined, area: "Kirkwood" }, { city: "kirkwood" })).toBe(true);
    expect(captainCovers({ regions: [], area: undefined }, { city: "kirkwood" })).toBe(false);
  });
});

describe("suggestCaptain", () => {
  it("returns null when there are no captains", () => {
    expect(suggestCaptain({ zip: "63101" }, [])).toBeNull();
  });

  it("prefers a region match over a less-loaded captain", () => {
    const near = cap({ email: "near@x.com", regions: ["63101"], teamSize: 9 });
    const idle = cap({ email: "idle@x.com", teamSize: 0 });
    expect(suggestCaptain({ zip: "63101" }, [idle, near])?.email).toBe("near@x.com");
  });

  it("prefers an area match over a less-loaded captain", () => {
    const near = cap({ email: "near@x.com", firstName: "Near", area: "63101", teamSize: 9 });
    const idle = cap({ email: "idle@x.com", firstName: "Idle", teamSize: 0 });
    expect(suggestCaptain({ zip: "63101" }, [idle, near])?.email).toBe("near@x.com");
  });

  it("falls back to the least-loaded captain when none cover the area", () => {
    const busy = cap({ email: "busy@x.com", teamSize: 5 });
    const light = cap({ email: "light@x.com", teamSize: 1 });
    expect(suggestCaptain({ zip: "99999" }, [busy, light])?.email).toBe("light@x.com");
  });

  it("breaks ties deterministically by email", () => {
    const a = cap({ email: "a@x.com", teamSize: 2 });
    const b = cap({ email: "b@x.com", teamSize: 2 });
    expect(suggestCaptain({}, [b, a])?.email).toBe("a@x.com");
  });
});
