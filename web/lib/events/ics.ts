// Minimal, dependency-free iCalendar (RFC 5545) builder. Handles a single event
// ("Add to calendar" download) and a multi-event feed (a subscribable calendar).
// Timed events are emitted in America/Chicago via TZID + a VTIMEZONE block so
// clients show the correct local wall-clock across DST; all-day events use
// VALUE=DATE. DTSTAMP stays UTC (it's a protocol timestamp, not a local time).
import type { EventRow } from "@/lib/events";
import { SITE_URL } from "@/lib/site";
import { isoToCentralLocal } from "@/lib/events/time";

const TZID = "America/Chicago";

// Fixed VTIMEZONE for America/Chicago (US DST rules in effect since 2007).
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "DTSTART:20070311T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "DTSTART:20071104T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

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

// ISO → Central local "20260712T180000" (no zone suffix; pairs with TZID).
function localStamp(iso: string): string | null {
  const m = isoToCentralLocal(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m ? `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00` : null;
}

// ISO → Central calendar date "20260712" (for all-day VALUE=DATE).
function localDate(iso: string): string | null {
  const m = isoToCentralLocal(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

function addDays(yyyymmdd: string, n: number): string {
  const dt = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`;
}

// Build the VEVENT lines for one event (no calendar wrapper).
function vevent(e: EventRow): string[] {
  const stamp = icsStamp(new Date().toISOString()) ?? "20260101T000000Z";
  const loc = [e.location.name, e.location.address, e.location.city].filter(Boolean).join(", ");
  const url = `${SITE_URL}/events/${e.id}`;

  let when: string[] = [];
  if (e.allDay) {
    const sd = localDate(e.start);
    if (sd) {
      const ed = e.end ? localDate(e.end) : null;
      when = [`DTSTART;VALUE=DATE:${sd}`, `DTEND;VALUE=DATE:${addDays(ed ?? sd, 1)}`]; // DTEND is exclusive
    }
  } else {
    const s = localStamp(e.start);
    // Default a 2-hour block when no end is set, so calendars don't show it as all-day.
    const endIso = e.end || new Date(new Date(e.start).getTime() + 2 * 3600_000).toISOString();
    const en = localStamp(endIso);
    if (s) when.push(`DTSTART;TZID=${TZID}:${s}`);
    if (en) when.push(`DTEND;TZID=${TZID}:${en}`);
  }

  return [
    "BEGIN:VEVENT",
    `UID:${e.id}@mattgrantforcongress.org`,
    `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${esc(e.title)}`,
    ...(loc ? [`LOCATION:${esc(loc)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    `URL:${esc(url)}`,
    "END:VEVENT",
  ];
}

function wrap(header: string[], events: EventRow[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Matt Grant for Congress//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...header,
    ...VTIMEZONE,
    ...events.flatMap(vevent),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Single-event .ics for an "Add to calendar" download. */
export function eventToIcs(e: EventRow): string {
  return wrap([], [e]);
}

/** Subscribable multi-event feed (Apple/Google/Outlook "subscribe to calendar"). */
export function eventsToIcsFeed(events: EventRow[]): string {
  return wrap(
    [
      "X-WR-CALNAME:Matt Grant for Congress — Events",
      `X-WR-TIMEZONE:${TZID}`,
      "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
      "X-PUBLISHED-TTL:PT12H",
    ],
    events,
  );
}
