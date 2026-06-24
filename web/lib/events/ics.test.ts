import { describe, it, expect } from "vitest";
import { eventToIcs, icsStamp } from "./ics";
import type { EventRow } from "@/lib/events/types";

const base: EventRow = {
  id: "evt-1",
  title: "Rally, Chesterfield; come!",
  type: "rally",
  start: "2026-07-12T23:00:00.000Z",
  end: "2026-07-13T01:00:00.000Z",
  location: { name: "City Park", address: "1 Main St", city: "Chesterfield", county: "St. Louis County" },
  districtKey: "place:chesterfield",
  description: "Line one\nLine two",
  status: "PUBLISHED",
  capacity: null,
  signups: [],
  source: "manual",
  parseConfidence: null,
  notifiedEmailAt: null,
  notifiedSmsAt: null,
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

  it("emits a well-formed VCALENDAR/VEVENT", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("UID:evt-1@mattgrantforcongress.org");
    expect(ics).toContain("DTSTART:20260712T230000Z");
    expect(ics).toContain("DTEND:20260713T010000Z");
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
    expect(ics2).toContain("DTSTART:20260712T230000Z");
    expect(ics2).toContain("DTEND:20260713T010000Z");
  });
});
