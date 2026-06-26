// Airtable-backed source for the PUBLIC events page. When the Airtable env is
// configured (AIRTABLE_API_KEY present), the public site reads upcoming events
// from the campaign's Airtable "Events" table — the no-code source of truth
// staff edit directly — instead of DynamoDB. Records are mapped into the same
// `EventRow` shape the page already renders, so nothing downstream changes.
//
// Server-only (uses getSecret + fetch with an auth token). The dashboard CRUD
// and RSVP flow still operate on the DynamoDB store; this only swaps the public
// READ path. See lib/events.ts where listUpcomingEvents/getEvent delegate here.
import { getSecret } from "@/lib/ssm";
import { isEventType, type EventRow, type EventType } from "@/lib/events/types";

// Base/table default to the campaign's "Matt Grant for Congress — Volunteer
// Engagement" base + Events table; override via env if they ever move.
const BASE_ID = process.env.AIRTABLE_BASE_ID || "appAmtan3qWZE7iGR";
const TABLE_ID = process.env.AIRTABLE_EVENTS_TABLE_ID || "tblujaq4mmzZdfR3s";

// Airtable "Event Type" single-select → repo EventType. Anything unmapped → "other".
const TYPE_MAP: Record<string, EventType> = {
  "House party": "meet-greet",
  "Town hall": "town-hall",
  "Community forum": "debate",
  Fundraiser: "fundraiser",
  "Canvass launch": "canvass",
  Tabling: "volunteer-shift",
  Parade: "parade",
  "Volunteer orientation": "volunteer-shift",
  "Meet & greet": "meet-greet",
  "Phone bank night": "volunteer-shift",
};

// Airtable "Status" values that are public-ready → mapped to PUBLISHED.
const PUBLIC_STATUSES = new Set(["Confirmed", "Promoting"]);

type AirtableRecord = { id: string; fields: Record<string, unknown> };

/** True when the Airtable source is configured and should drive the public page. */
export async function airtableEventsConfigured(): Promise<boolean> {
  return Boolean(await getSecret("AIRTABLE_API_KEY"));
}

// "6:30 PM" / "9:00 AM" / "18:30" → "18:30:00". null if unparseable.
function parseTime(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}:00`;
}

// Airtable Date (YYYY-MM-DD) + Time (free text) → { start ISO, allDay }.
function toStart(date: unknown, time: unknown): { start: string; allDay: boolean } {
  const d = typeof date === "string" ? date.slice(0, 10) : "";
  if (!d) return { start: "", allDay: true };
  const parsed = typeof time === "string" && time.trim() ? parseTime(time) : null;
  return parsed ? { start: `${d}T${parsed}`, allDay: false } : { start: `${d}T00:00:00`, allDay: true };
}

function recordToRow(rec: AirtableRecord): EventRow | null {
  const f = rec.fields;
  const title = String(f["Event Name"] ?? "").trim();
  const { start, allDay } = toStart(f["Date"], f["Time"]);
  if (!title || !start) return null; // skip incomplete rows
  const rawType = String(f["Event Type"] ?? "");
  const type: EventType = TYPE_MAP[rawType] ?? (isEventType(rawType) ? rawType : "other");
  const status = String(f["Status"] ?? "");
  return {
    id: rec.id,
    title,
    type,
    start,
    end: null,
    allDay,
    location: { name: String(f["Venue"] ?? "").trim(), address: "", city: "", county: "" },
    lat: null,
    lng: null,
    districtKey: "district:mo-02",
    description: "",
    status: PUBLIC_STATUSES.has(status) ? "PUBLISHED" : status === "Cancelled" ? "CANCELLED" : "DRAFT",
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
    createdBy: "airtable",
    createdAt: "",
    updatedAt: null,
  };
}

async function fetchRecords(): Promise<AirtableRecord[]> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return [];
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 900 }, // cap Airtable hits; refresh ~every 15 min
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { records?: AirtableRecord[] };
    return data.records ?? [];
  } catch {
    return [];
  }
}

/** Upcoming events from Airtable, mapped to EventRow (mirrors the DynamoDB version). */
export async function listUpcomingEventsFromAirtable(
  opts?: { limit?: number; publishedOnly?: boolean },
): Promise<EventRow[]> {
  const now = new Date().toISOString();
  let rows = (await fetchRecords())
    .map(recordToRow)
    .filter((r): r is EventRow => r != null)
    .filter((r) => r.status !== "CANCELLED")
    .filter((r) => r.start >= now)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (opts?.publishedOnly) rows = rows.filter((r) => r.status === "PUBLISHED");
  return opts?.limit ? rows.slice(0, opts.limit) : rows;
}

/** Single Airtable event by record id (for the public /events/[id] detail page). */
export async function getEventFromAirtable(id: string): Promise<EventRow | null> {
  if (!id) return null;
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const rec = (await res.json()) as AirtableRecord;
    return rec?.id ? recordToRow(rec) : null;
  } catch {
    return null;
  }
}
