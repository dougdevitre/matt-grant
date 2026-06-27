import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { resolveDistrict } from "@/lib/events/districts";
import { suggestPriority } from "@/lib/events/priority";
import { defaultChecklistFor } from "@/lib/events/checklists";
import {
  isEventType, isEventStatus,
  type EventType, type EventStatus, type EventLocation, type Signup, type EventStaffer, type EventPriority, type EventChecklistItem, type EventRow, type PublicEvent, type EventInput, type EventNotifyResult,
} from "@/lib/events/types";
import { airtableEventsConfigured, listUpcomingEventsFromAirtable, getEventFromAirtable } from "@/lib/events/airtable";

// Campaign events / appearances. One DynamoDB partition (PK="EVENT") with
// SK=`${startISO}#${id}` so a Query returns them in chronological order and an
// "upcoming" read is a key-range query (SK >= now). Signups are embedded on the
// item (public RSVPs may be people not in any contact store); PII in `signups`
// renders ONLY in the staff dashboard — the public page shows aggregate counts.
// Pure constants/types live in ./events/types (client-safe); re-exported here.
export * from "@/lib/events/types";

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const sk = (start: string, id: string) => `${start}#${id}`;

function cleanLocation(loc: EventLocation): EventLocation {
  return {
    name: clip(loc.name, 160),
    address: clip(loc.address, 200),
    city: clip(loc.city, 80),
    county: clip(loc.county, 80),
  };
}

function rawToRow(it: Record<string, unknown>): EventRow {
  const loc = (it.location ?? {}) as Record<string, unknown>;
  return {
    id: String(it.id),
    title: String(it.title ?? ""),
    type: isEventType(it.type) ? it.type : "other",
    start: String(it.start ?? ""),
    end: (it.end as string) ?? null,
    allDay: it.allDay === true,
    location: {
      name: String(loc.name ?? ""),
      address: String(loc.address ?? ""),
      city: String(loc.city ?? ""),
      county: String(loc.county ?? ""),
    },
    lat: it.lat == null ? null : Number(it.lat),
    lng: it.lng == null ? null : Number(it.lng),
    districtKey: String(it.districtKey ?? "district:mo-02"),
    description: String(it.description ?? ""),
    status: isEventStatus(it.status) ? it.status : "DRAFT",
    capacity: it.capacity == null ? null : Number(it.capacity),
    priority: it.priority === 1 || it.priority === 3 ? it.priority : 2,
    priorityManual: it.priorityManual === true,
    checklist: Array.isArray(it.checklist) ? (it.checklist as EventChecklistItem[]) : [],
    signups: Array.isArray(it.signups) ? (it.signups as Signup[]) : [],
    captain: (it.captain as EventStaffer) ?? null,
    volunteers: Array.isArray(it.volunteers) ? (it.volunteers as EventStaffer[]) : [],
    source: it.source === "email" ? "email" : "manual",
    parseConfidence: it.parseConfidence == null ? null : Number(it.parseConfidence),
    notifiedEmailAt: (it.notifiedEmailAt as string) ?? null,
    notifiedSmsAt: (it.notifiedSmsAt as string) ?? null,
    notifyResult: (it.notifyResult as EventRow["notifyResult"]) ?? null,
    createdBy: String(it.createdBy ?? ""),
    createdAt: String(it.createdAt ?? ""),
    updatedAt: (it.updatedAt as string) ?? null,
  };
}

export function toPublicEvent(e: EventRow): PublicEvent {
  return {
    id: e.id,
    title: e.title,
    type: e.type,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    location: e.location,
    districtKey: e.districtKey,
    description: e.description,
    capacity: e.capacity,
    signupCount: e.signups.length,
    goingCount: e.signups.reduce((s, x) => s + (Number(x.count) || 1), 0),
    createdAt: e.createdAt,
  };
}

// Build the persisted item from validated input. Drops empty/undefined so the
// table's removeUndefinedValues keeps the row tidy.
function buildItem(id: string, input: EventInput, now: string, prior?: Partial<EventRow>) {
  const start = input.start;
  const districtKey = resolveDistrict(input.location).key;
  const type: EventType = isEventType(input.type) ? input.type : "other";
  // On create (no prior) seed the checklist from the type template and the
  // priority from the rubric; on update, keep prior unless the patch overrides.
  const priority: EventPriority =
    input.priority ?? prior?.priority ?? suggestPriority({ type, districtKey }).tier;
  const checklist: EventChecklistItem[] = input.checklist ?? prior?.checklist ?? defaultChecklistFor(type);
  return {
    PK: PK.events,
    SK: sk(start, id),
    id,
    title: clip(input.title, 140),
    type,
    start,
    end: input.end || undefined,
    allDay: input.allDay ?? prior?.allDay ?? undefined,
    location: cleanLocation(input.location),
    lat: input.lat ?? prior?.lat ?? undefined,
    lng: input.lng ?? prior?.lng ?? undefined,
    districtKey,
    description: clip(input.description, 4000),
    status: input.status ?? prior?.status ?? "DRAFT",
    capacity: input.capacity ?? undefined,
    priority,
    priorityManual: input.priorityManual ?? prior?.priorityManual ?? false,
    checklist,
    signups: prior?.signups ?? [],
    captain: input.captain !== undefined ? input.captain ?? undefined : prior?.captain ?? undefined,
    volunteers: input.volunteers ?? prior?.volunteers ?? undefined,
    source: input.source ?? prior?.source ?? "manual",
    parseConfidence: input.parseConfidence ?? prior?.parseConfidence ?? undefined,
    notifiedEmailAt: prior?.notifiedEmailAt ?? undefined,
    notifiedSmsAt: prior?.notifiedSmsAt ?? undefined,
    notifyResult: prior?.notifyResult ?? undefined,
    createdBy: prior?.createdBy ?? input.createdBy,
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function createEvent(input: EventInput): Promise<string> {
  const id = newId();
  const now = new Date().toISOString();
  await ddb.send(new PutCommand({ TableName: TABLE, Item: buildItem(id, input, now) }));
  return id;
}

// Find the raw item (incl. PK/SK) by id — needed because SK embeds the start time.
async function findRaw(id: string): Promise<Record<string, unknown> | null> {
  if (!dbConfigured || !id) return null;
  const r = await ddb.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.events } }),
  );
  return ((r.Items ?? []) as Record<string, unknown>[]).find((x) => x.id === id) ?? null;
}

export async function getEvent(id: string): Promise<EventRow | null> {
  // When Airtable drives the public site, record ids are Airtable rec ids — resolve
  // there first so /events/[id] detail pages work; fall back to the DynamoDB store.
  if (await airtableEventsConfigured()) {
    const fromAirtable = await getEventFromAirtable(id);
    if (fromAirtable) return fromAirtable;
  }
  const raw = await findRaw(id);
  return raw ? rawToRow(raw) : null;
}

export async function listEvents(): Promise<{ connected: boolean; rows: EventRow[] }> {
  if (!dbConfigured) return { connected: false, rows: [] };
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.events } }),
    );
    const rows = ((r.Items ?? []) as Record<string, unknown>[]).map(rawToRow).sort((a, b) => a.start.localeCompare(b.start));
    return { connected: true, rows };
  } catch {
    return { connected: false, rows: [] };
  }
}

// Upcoming events via a key-range query (SK >= now). publishedOnly for the public page.
export async function listUpcomingEvents(opts?: { limit?: number; publishedOnly?: boolean }): Promise<EventRow[]> {
  // Airtable is the public source of truth when configured (staff edit it no-code);
  // otherwise fall back to the DynamoDB event store. Same EventRow shape either way.
  if (await airtableEventsConfigured()) return listUpcomingEventsFromAirtable(opts);
  if (!dbConfigured) return [];
  try {
    const now = new Date().toISOString();
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p AND SK >= :now",
        ExpressionAttributeValues: { ":p": PK.events, ":now": now },
        ScanIndexForward: true, // chronological
      }),
    );
    let rows = ((r.Items ?? []) as Record<string, unknown>[]).map(rawToRow).filter((e) => e.status !== "CANCELLED");
    if (opts?.publishedOnly) rows = rows.filter((e) => e.status === "PUBLISHED");
    return opts?.limit ? rows.slice(0, opts.limit) : rows;
  } catch {
    return [];
  }
}

// Full overwrite update. If `start` changes the SK moves, so we put-then-delete-old.
export async function updateEvent(id: string, patch: Partial<EventInput> & { status?: EventStatus }): Promise<boolean> {
  const raw = await findRaw(id);
  if (!raw) return false;
  const cur = rawToRow(raw);
  const oldSK = String(raw.SK);
  const now = new Date().toISOString();
  const merged: EventInput = {
    title: patch.title ?? cur.title,
    type: patch.type ?? cur.type,
    start: patch.start ?? cur.start,
    end: patch.end !== undefined ? patch.end : cur.end,
    allDay: patch.allDay !== undefined ? patch.allDay : cur.allDay,
    location: patch.location ?? cur.location,
    lat: patch.lat !== undefined ? patch.lat : cur.lat,
    lng: patch.lng !== undefined ? patch.lng : cur.lng,
    description: patch.description ?? cur.description,
    capacity: patch.capacity !== undefined ? patch.capacity : cur.capacity,
    priority: patch.priority !== undefined ? patch.priority : cur.priority,
    priorityManual: patch.priorityManual !== undefined ? patch.priorityManual : cur.priorityManual,
    checklist: patch.checklist !== undefined ? patch.checklist : cur.checklist,
    captain: patch.captain !== undefined ? patch.captain : cur.captain,
    volunteers: patch.volunteers !== undefined ? patch.volunteers : cur.volunteers,
    status: patch.status ?? cur.status,
    createdBy: cur.createdBy,
  };
  const item = buildItem(id, merged, now, cur);
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  if (item.SK !== oldSK) await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PK.events, SK: oldSK } }));
  return true;
}

export async function setEventStatus(id: string, status: EventStatus): Promise<boolean> {
  const raw = await findRaw(id);
  if (!raw) return false;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.events, SK: String(raw.SK) },
      UpdateExpression: "SET #s = :s, updatedAt = :u",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status, ":u": new Date().toISOString() },
    }),
  );
  return true;
}

// Record the publish-time notification outcome so the dashboard can show whether
// the email/SMS broadcast actually went out (not just that status flipped).
export async function setEventNotify(id: string, result: EventNotifyResult): Promise<boolean> {
  const raw = await findRaw(id);
  if (!raw) return false;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.events, SK: String(raw.SK) },
      UpdateExpression: "SET notifyResult = :r, updatedAt = :u",
      ExpressionAttributeValues: { ":r": result, ":u": new Date().toISOString() },
    }),
  );
  return true;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const raw = await findRaw(id);
  if (!raw) return false;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PK.events, SK: String(raw.SK) } }));
  return true;
}

export async function addSignup(
  id: string,
  input: { name: string; email?: string; phone?: string; role?: string; count?: number },
): Promise<boolean> {
  const raw = await findRaw(id);
  if (!raw) return false;
  const signup: Signup = {
    id: newId(),
    name: clip(input.name, 120),
    email: input.email ? clip(input.email, 160).toLowerCase() : null,
    phone: input.phone ? clip(input.phone, 40) : null,
    role: input.role ? clip(input.role, 60) : null,
    count: Math.max(1, Math.min(20, Number(input.count) || 1)),
    createdAt: new Date().toISOString(),
  };
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.events, SK: String(raw.SK) },
      UpdateExpression: "SET signups = list_append(if_not_exists(signups, :empty), :s), updatedAt = :u",
      ExpressionAttributeValues: { ":empty": [], ":s": [signup], ":u": new Date().toISOString() },
    }),
  );
  return true;
}

// Claim one notification channel for an event idempotently. Returns true the FIRST
// time (caller should send), false if already claimed — so a re-publish or a
// double-click can never double-queue a broadcast.
export async function claimNotify(id: string, channel: "Email" | "Sms"): Promise<boolean> {
  const raw = await findRaw(id);
  if (!raw) return false;
  const attr = channel === "Email" ? "notifiedEmailAt" : "notifiedSmsAt";
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.events, SK: String(raw.SK) },
        UpdateExpression: `SET ${attr} = :now`,
        ConditionExpression: `attribute_not_exists(${attr})`,
        ExpressionAttributeValues: { ":now": new Date().toISOString() },
      }),
    );
    return true;
  } catch (e) {
    if ((e as { name?: string })?.name === "ConditionalCheckFailedException") return false;
    throw e;
  }
}
