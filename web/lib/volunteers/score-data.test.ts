import { describe, it, expect, vi } from "vitest";

// score-data.ts is server-only; neutralize so we can unit-test the PURE deriver.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/staff", () => ({ listStaff: vi.fn() }));
vi.mock("@/lib/queries", () => ({ getVolunteers: vi.fn() }));
vi.mock("@/lib/events", () => ({ listEvents: vi.fn() }));

import { deriveSignals } from "./score-data";
import type { VolunteerRow } from "@/lib/queries";

const vol = (over: Partial<VolunteerRow>): VolunteerRow => ({
  id: "v", name: "V", email: "v@x.com", phone: null, city: null, interests: null,
  interestTags: [], notes: null, status: "NEW", assignedTo: null, captainEmail: "c@x.com",
  zip: null, mode: null, skills: [], availability: [], roles: [], commitment: null, door: null,
  optedOut: false, pledgeFulfilled: false, interestedTasks: [], lastContactedAt: null,
  createdAt: "2026-01-01", ...over,
});

describe("deriveSignals", () => {
  it("counts roster, contactable, activated, engaged", () => {
    const team = [
      vol({ status: "ACTIVE" }), // engaged + activated
      vol({ status: "CONTACTED" }), // engaged
      vol({ status: "NEW", interestedTasks: ["t1"] }), // engaged (raised a hand)
      vol({ status: "NEW", lastContactedAt: "2026-02-01" }), // engaged (contacted)
      vol({ status: "NEW" }), // cold — not engaged
    ];
    const s = deriveSignals(team, 0, true);
    expect(s.rosterSize).toBe(5);
    expect(s.contactable).toBe(5);
    expect(s.activated).toBe(1);
    expect(s.engaged).toBe(4);
    expect(s.hasRegion).toBe(true);
  });

  it("excludes opted-out volunteers from contactable and every numerator", () => {
    const team = [
      vol({ status: "ACTIVE", optedOut: true }), // on roster, but opted out
      vol({ status: "ACTIVE", optedOut: false }),
    ];
    const s = deriveSignals(team, 0, false);
    expect(s.rosterSize).toBe(2); // still on the roster (span)
    expect(s.contactable).toBe(1); // opted-out excluded
    expect(s.activated).toBe(1); // only the contactable active one
    expect(s.engaged).toBe(1);
  });

  it("passes through the event count and region flag", () => {
    const s = deriveSignals([], 3, false);
    expect(s.recentEvents).toBe(3);
    expect(s.rosterSize).toBe(0);
    expect(s.contactable).toBe(0);
    expect(s.hasRegion).toBe(false);
  });
});
