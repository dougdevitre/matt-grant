import { describe, it, expect } from "vitest";
import { filterUpcomingOwned } from "./events";
import type { EventRow } from "./events/types";

// Accuracy guard for the captain-scoped events filter powering /api/ext/team. Exercises
// the REAL owner/upcoming/cancelled logic (not a mocked reader), including cross-captain
// isolation — the security-relevant property.
const NOW = new Date("2026-07-06T00:00:00.000Z");

const ev = (over: Partial<EventRow> & { id: string }): EventRow =>
  ({
    title: over.title ?? over.id,
    type: "canvass",
    start: over.start ?? "2026-07-10T15:00:00.000Z",
    end: null,
    allDay: false,
    location: { name: "", address: "", city: "", county: "" } as EventRow["location"],
    lat: null,
    lng: null,
    districtKey: "",
    description: "",
    status: over.status ?? "PUBLISHED",
    capacity: null,
    priority: 2,
    priorityManual: false,
    checklist: [],
    signups: [],
    captain: over.captain ?? { id: "cap@x.org", name: "Cap" },
    volunteers: [],
    source: "manual",
    parseConfidence: null,
    notifiedEmailAt: null,
    notifiedSmsAt: null,
    notifyResult: null,
    createdBy: "cap@x.org",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: null,
    ...over,
  }) as EventRow;

describe("filterUpcomingOwned", () => {
  it("returns ONLY the caller's own upcoming events (cross-captain isolation)", () => {
    const rows = [
      ev({ id: "mine-soon", start: "2026-07-10T00:00:00.000Z", captain: { id: "Cap@X.org", name: "Cap" } }), // case-insensitive
      ev({ id: "other", captain: { id: "rival@x.org", name: "Rival" } }), // another captain — must be excluded
      ev({ id: "unowned", captain: null }), // no owner — excluded
    ];
    const out = filterUpcomingOwned(rows, "cap@x.org", NOW);
    expect(out.map((e) => e.id)).toEqual(["mine-soon"]);
  });

  it("drops CANCELLED and already-started events; keeps undated; sorts soonest-first", () => {
    const rows = [
      ev({ id: "later", start: "2026-08-01T00:00:00.000Z" }),
      ev({ id: "past", start: "2026-07-01T00:00:00.000Z" }), // before NOW → dropped
      ev({ id: "cancelled", start: "2026-07-20T00:00:00.000Z", status: "CANCELLED" }), // dropped
      ev({ id: "sooner", start: "2026-07-08T00:00:00.000Z" }),
      ev({ id: "undated", start: "not-a-date" }), // unparseable → kept
    ];
    const out = filterUpcomingOwned(rows, "cap@x.org", NOW);
    expect(out.map((e) => e.id)).toEqual(["sooner", "later", "undated"]); // ISO dates sort before "not-a-date" ('2' < 'n')
    expect(out.map((e) => e.id)).not.toContain("past");
    expect(out.map((e) => e.id)).not.toContain("cancelled");
  });
});
