// Minimal, dependency-free iCalendar (RFC 5545) builder for a single event. Enough
// for an "Add to calendar" download that Apple/Google/Outlook all accept. Times are
// emitted as UTC (…Z); we don't ship VTIMEZONE blocks yet (Phase 2 polish).
import type { EventRow } from "@/lib/events";
import { SITE_URL } from "@/lib/site";

// Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, and newlines.
function esc(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fold long content lines to 75 octets with a leading space on continuations.
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return out.join("\r\n");
}

// ISO 8601 → iCal UTC stamp: 20260712T180000Z. Returns null for an unparseable date.
export function icsStamp(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function eventToIcs(e: EventRow): string {
  const dtStart = icsStamp(e.start);
  // Default a 2-hour block when no end is set, so calendars don't show it as all-day.
  const endIso = e.end || new Date(new Date(e.start).getTime() + 2 * 3600_000).toISOString();
  const dtEnd = icsStamp(endIso);
  const stamp = icsStamp(new Date().toISOString()) ?? "20260101T000000Z";
  const loc = [e.location.name, e.location.address, e.location.city].filter(Boolean).join(", ");
  const url = `${SITE_URL}/events/${e.id}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Matt Grant for Congress//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@mattgrantforcongress.org`,
    `DTSTAMP:${stamp}`,
    ...(dtStart ? [`DTSTART:${dtStart}`] : []),
    ...(dtEnd ? [`DTEND:${dtEnd}`] : []),
    `SUMMARY:${esc(e.title)}`,
    ...(loc ? [`LOCATION:${esc(loc)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    `URL:${esc(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
