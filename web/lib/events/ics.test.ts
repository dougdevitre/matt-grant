import { describe, it, expect } from "vitest";
import { eventToIcs, eventsToIcsFeed, icsStamp } from "./ics";
import type { EventRow } from "@/lib/events/types";

const base: EventRow = {
  id: "evt-1",
  title: "Rally, Chesterfield; come!",
  type: "rally",
  start: "2026-07-12T23:00:00.000Z", // 6:00 PM CDT
  end: "2026-07-13T01:00:00.000Z", // 8:00 PM CDT (same Central day)
  allDay: false,
  location: { name: "City Park", address: "1 Main St", city: "Chesterfield", county: "St. Louis County" },
  lat: null,
  lng: null,
  districtKey: "place:chesterfield",
  description: "Line one\nLine two",
  status: "PUBLISHED",
  capacity: null,
  priority: 2,
  priorityManual: false,
  checklist: [],
  signups: [],
  captain: null,
  volunteers: [],
  source: "manual",
  parseConfidence: null,
  notifiedEmailAt: null,
  notifiedSmsAt: null,
  notifyResult: null,
  createdBy: "x",
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: null,
};

describe("icsStamp", () => {
  it("formats ISO → iCal UTC stamp", () => {
    expect(icsStamp("2026-07-12T23:00:00.000Z")).toBe("20260712T230000Z");
  });
  it("returns null for an unparseable date", () => {
    expect(icsStamp("not a date")).toBeNull();
  });
});

describe("eventToIcs", () => {
  const ics = eventToIcs(base);

  it("emits a well-formed VCALENDAR/VEVENT with a VTIMEZONE", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("TZID:America/Chicago");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("UID:evt-1@mattgrantforcongress.org");
  });

  it("emits times in Central local with a TZID (not floating UTC)", () => {
    expect(ics).toContain("DTSTART;TZID=America/Chicago:20260712T180000");
    expect(ics).toContain("DTEND;TZID=America/Chicago:20260712T200000");
  });

  it("escapes commas, semicolons, and newlines per RFC 5545", () => {
    expect(ics).toContain("SUMMARY:Rally\\, Chesterfield\\; come!");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("uses CRLF line endings", () => {
    expect(ics).toContain("\r\n");
  });

  it("defaults a 2-hour DTEND when no end is set", () => {
    const ics2 = eventToIcs({ ...base, end: null });
    expect(ics2).toContain("DTSTART;TZID=America/Chicago:20260712T180000");
    expect(ics2).toContain("DTEND;TZID=America/Chicago:20260712T200000");
  });

  it("emits all-day events as VALUE=DATE (exclusive DTEND)", () => {
    const ics3 = eventToIcs({ ...base, allDay: true, end: null });
    expect(ics3).toContain("DTSTART;VALUE=DATE:20260712");
    expect(ics3).toContain("DTEND;VALUE=DATE:20260713");
    expect(ics3).not.toContain("TZID=America/Chicago:2026"); // no timed DTSTART
  });
});

describe("eventsToIcsFeed", () => {
  const feed = eventsToIcsFeed([base, { ...base, id: "evt-2", title: "Second event" }]);

  it("wraps multiple VEVENTs in one VCALENDAR with a calendar name", () => {
    expect(feed.match(/BEGIN:VCALENDAR/g)).toHaveLength(1);
    expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(feed).toContain("X-WR-CALNAME:Matt Grant for Congress");
    expect(feed).toContain("UID:evt-1@mattgrantforcongress.org");
    expect(feed).toContain("UID:evt-2@mattgrantforcongress.org");
  });

  it("handles an empty list without breaking the wrapper", () => {
    const empty = eventsToIcsFeed([]);
    expect(empty).toContain("BEGIN:VCALENDAR");
    expect(empty).toContain("END:VCALENDAR");
    expect(empty.match(/BEGIN:VEVENT/g)).toBeNull();
  });
});
