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
import { isEventType, type EventRow, type EventType, type EventStatus } from "@/lib/events/types";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import { geocodeAddress } from "@/lib/events/geocode";

// Volunteer Engagement base + Events table, from the central registry; override
// via env if they ever move. One workspace token reads every base.
const BASE_ID = process.env.AIRTABLE_BASE_ID || AIRTABLE_BASES.volunteer.id;
const TABLE_ID = process.env.AIRTABLE_EVENTS_TABLE_ID || AIRTABLE_BASES.volunteer.tables.events;

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

/** Exported for unit tests (pure). "Address" is an optional Airtable field — a
 *  street address incl. city, MO assumed — read defensively: rows without it (or
 *  bases where the field doesn't exist yet) simply carry no address and skip
 *  geocoding, exactly the pre-existing behavior. */
export function recordToRow(rec: AirtableRecord): EventRow | null {
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
    location: { name: String(f["Venue"] ?? "").trim(), address: String(f["Address"] ?? "").trim(), city: "", county: "" },
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

// Fill lat/lng from the Address field via the Census geocoder so Airtable-
// originated events plot on the field map (previously they were hardcoded
// null and never appeared). Best-effort and cheap: only rows WITH an address
// and WITHOUT coords geocode, the geocoder fetch is cached a day per address,
// and any failure just leaves the event unplotted — lists render regardless.
async function withCoords(rows: EventRow[]): Promise<EventRow[]> {
  await Promise.all(
    rows
      .filter((r) => r.lat == null && r.location.address)
      .map(async (r) => {
        const c = await geocodeAddress(r.location);
        if (c) {
          r.lat = c.lat;
          r.lng = c.lng;
        }
      }),
  );
  return rows;
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
  rows = opts?.limit ? rows.slice(0, opts.limit) : rows;
  return withCoords(rows);
}

// ── One-way mirror: dashboard (DynamoDB) → Airtable ───────────────────────────────
// DynamoDB stays the operational source of truth for events (checklists, priority,
// publish-notify claims, captain/volunteer staffing, RSVPs). This mirror reflects the
// CONTENT subset into the Airtable "Events" table so staff-created/edited events also
// appear in the no-code admin calendar AND on the public site (which reads Airtable).
//
// NOT gated by the Front-End Access control table: that governs what the dashboard UI
// lets a user do to a table directly. This is backend plumbing that projects an already-
// authorized write (the dashboard event actions are gated by the manageEvents capability).
// Strictly best-effort — every function swallows errors so an Airtable hiccup can never
// block or fail a DynamoDB event save.

// repo EventType → Airtable "Event Type" choice (omit when there's no clean equivalent).
const FWD_TYPE: Partial<Record<EventType, string>> = {
  "town-hall": "Town hall",
  fundraiser: "Fundraiser",
  canvass: "Canvass launch",
  parade: "Parade",
  "meet-greet": "Meet & greet",
  debate: "Community forum",
  "volunteer-shift": "Volunteer orientation",
  // rally / other: no matching Airtable option — leave the field blank.
};

// repo EventStatus → Airtable "Status" choice. PUBLISHED → "Confirmed" (a public-ready
// status the read path maps back to PUBLISHED); DRAFT → "Planning"; CANCELLED → "Cancelled".
const FWD_STATUS: Record<EventStatus, string> = {
  DRAFT: "Planning",
  PUBLISHED: "Confirmed",
  CANCELLED: "Cancelled",
};

// ISO start → "6:30 PM" (Airtable Time is free text). "" for all-day. Parses the time
// portion of the string directly to avoid any timezone shift from Date().
function formatTime(start: string, allDay: boolean): string {
  if (allDay) return "";
  const m = start.match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

function eventToFields(e: EventRow): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    "Event Name": e.title,
    Date: e.start.slice(0, 10),
    Venue: e.location.name || "",
    Status: FWD_STATUS[e.status] ?? "Planning",
    Notes: e.description || "",
  };
  const type = FWD_TYPE[e.type];
  if (type) fields["Event Type"] = type;
  const time = formatTime(e.start, e.allDay);
  if (time) fields.Time = time;
  if (e.capacity != null) fields.Capacity = e.capacity;
  if (e.captain?.name) fields["Host / Lead"] = e.captain.name;
  // Round-trip the street address so an Airtable-read event geocodes the same
  // spot the dashboard plotted. Requires an actual STREET line — a bare city is
  // not an address and would never geocode on the read side. Optional field —
  // the mirror retries without it if the Airtable table lacks the column (below).
  if (e.location.address) {
    fields.Address = [e.location.address, e.location.city].filter(Boolean).join(", ");
  }
  return fields;
}

// Raw Airtable write (kept here, like the reads above, so this module stays free of the
// server-only shared client — events/airtable.ts is imported transitively by widely-used code).
async function writeAirtable(method: "POST" | "PATCH", path: string, body: unknown): Promise<Response | null> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return null;
  return fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
}

/**
 * Mirror an event's content into Airtable. Pass the existing Airtable record id to update it
 * in place; omit it to create a new record. Returns the Airtable record id (so the caller can
 * persist it on the DynamoDB item for future updates), or null when unconfigured / on any error.
 */
export async function mirrorEventToAirtable(e: EventRow, recId?: string | null): Promise<string | null> {
  try {
    const fields = eventToFields(e);
    const send = (f: Record<string, unknown>) =>
      recId
        ? writeAirtable("PATCH", `/${recId}`, { typecast: true, fields: f })
        : writeAirtable("POST", "", { typecast: true, fields: f });
    let res = await send(fields);
    if (!res) return null; // unconfigured
    if (!res.ok && "Address" in fields) {
      // An unknown field name 422s the WHOLE record write. Address is the one
      // optional column staff may not have added to the Airtable table yet —
      // retry once without it so the mirror never regresses on its account.
      const { Address: _drop, ...withoutAddress } = fields;
      res = (await send(withoutAddress)) ?? res;
    }
    if (!res.ok) throw new Error(`${recId ? "PATCH" : "POST"} ${res.status}`);
    if (recId) return recId;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch (err) {
    console.warn(`[events] Airtable mirror ${recId ? "update" : "create"} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Mirror just a status change (cheaper than a full update). Best-effort no-op without a recId. */
export async function mirrorEventStatusToAirtable(recId: string | null | undefined, status: EventStatus): Promise<void> {
  if (!recId) return;
  try {
    const res = await writeAirtable("PATCH", `/${recId}`, { typecast: true, fields: { Status: FWD_STATUS[status] ?? "Planning" } });
    if (res && !res.ok) throw new Error(`PATCH ${res.status}`);
  } catch (err) {
    console.warn("[events] Airtable mirror status failed:", err instanceof Error ? err.message : err);
  }
}

/** Remove the mirrored Airtable record when an event is deleted. Best-effort. */
export async function deleteEventFromAirtable(recId: string | null | undefined): Promise<void> {
  if (!recId) return;
  try {
    const key = await getSecret("AIRTABLE_API_KEY");
    if (!key) return;
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`DELETE ${res.status}`);
  } catch (err) {
    console.warn("[events] Airtable mirror delete failed:", err instanceof Error ? err.message : err);
  }
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
    const row = rec?.id ? recordToRow(rec) : null;
    if (!row) return null;
    const [withGeo] = await withCoords([row]);
    return withGeo;
  } catch {
    return null;
  }
}
