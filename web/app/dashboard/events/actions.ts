"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  createEvent, updateEvent, setEventStatus, deleteEvent, getEvent, setEventNotify,
  isEventType, type EventType, type EventLocation,
} from "@/lib/events";
import { localCentralToIso } from "@/lib/events/time";
import { geocodeAddress } from "@/lib/events/geocode";
import { publishEventNotifications } from "@/lib/events/notify";
import { parseForwardedEmail, type EventDraft } from "@/lib/events/parseEmail";
import { refreshDistrictInsight } from "@/lib/events/insights";

export type EventState = { ok: boolean; message: string; id?: string };
export type ParseState = { ok: boolean; message: string; draft?: EventDraft };

async function gate(): Promise<{ email: string | null } | null> {
  const g = await staffGate();
  return g.ok && can(g.role, "manageEvents") ? { email: g.email } : null;
}

function refresh(id?: string) {
  revalidatePath("/dashboard/events");
  revalidatePath("/events");
  if (id) {
    revalidatePath(`/dashboard/events/${id}`);
    revalidatePath(`/events/${id}`);
  }
}

// Parse an optional numeric lat/lng the admin typed by hand. Blank → null.
function num(f: FormData, k: string): number | null {
  const raw = String(f.get(k) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return isFinite(n) ? n : null;
}

function readForm(f: FormData): { ok: boolean; type: EventType; location: EventLocation; start: string; end: string | null; allDay: boolean; title: string; description: string; capacity: number | null; lat: number | null; lng: number | null } {
  const title = String(f.get("title") ?? "").trim();
  const rawType = String(f.get("type") ?? "other");
  const start = localCentralToIso(String(f.get("start") ?? ""));
  const endLocal = String(f.get("end") ?? "").trim();
  const end = endLocal ? localCentralToIso(endLocal) : null;
  const allDay = f.get("allDay") === "on" || f.get("allDay") === "true";
  const capRaw = String(f.get("capacity") ?? "").trim();
  const capacity = capRaw ? Math.max(0, Number(capRaw) || 0) : null;
  return {
    ok: !!title && !!start,
    title,
    type: isEventType(rawType) ? rawType : "other",
    start,
    end,
    allDay,
    description: String(f.get("description") ?? "").trim(),
    capacity,
    lat: num(f, "lat"),
    lng: num(f, "lng"),
    location: {
      name: String(f.get("locName") ?? "").trim(),
      address: String(f.get("locAddress") ?? "").trim(),
      city: String(f.get("locCity") ?? "").trim(),
      county: String(f.get("locCounty") ?? "").trim(),
    },
  };
}

// Resolve the coordinates to store: a hand-entered lat+lng always wins; otherwise
// forward-geocode the street address (best-effort, may stay null). For an existing
// event we skip geocoding when the address is unchanged and coords already exist.
async function resolveCoords(
  d: { lat: number | null; lng: number | null; location: EventLocation },
  prior?: { lat: number | null; lng: number | null; address: string } | null,
): Promise<{ lat: number | null; lng: number | null }> {
  if (d.lat != null && d.lng != null) return { lat: d.lat, lng: d.lng };
  if (prior && prior.lat != null && prior.lng != null && prior.address === d.location.address) {
    return { lat: prior.lat, lng: prior.lng };
  }
  const hit = await geocodeAddress(d.location);
  return hit ? { lat: hit.lat, lng: hit.lng } : { lat: null, lng: null };
}

// Create or update (hidden `id` distinguishes). Returns state for the client form.
export async function saveEvent(formData: FormData): Promise<EventState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const id = String(formData.get("id") ?? "").trim();
  const d = readForm(formData);
  if (!d.ok) return { ok: false, message: "A title and start date/time are required." };
  if (d.end && d.end < d.start) return { ok: false, message: "The end time must be after the start time." };

  try {
    if (id) {
      const prior = await getEvent(id);
      const coords = await resolveCoords(d, prior ? { lat: prior.lat, lng: prior.lng, address: prior.location.address } : null);
      const okUpd = await updateEvent(id, {
        title: d.title, type: d.type, start: d.start, end: d.end, allDay: d.allDay,
        location: d.location, lat: coords.lat, lng: coords.lng,
        description: d.description, capacity: d.capacity, createdBy: g.email ?? "system",
      });
      if (!okUpd) return { ok: false, message: "Event not found." };
      refresh(id);
      return { ok: true, message: "Saved.", id };
    }
    const coords = await resolveCoords(d);
    const newId = await createEvent({
      title: d.title, type: d.type, start: d.start, end: d.end, allDay: d.allDay,
      location: d.location, lat: coords.lat, lng: coords.lng, description: d.description, capacity: d.capacity,
      status: "DRAFT", source: "manual", createdBy: g.email ?? "system",
    });
    refresh(newId);
    return { ok: true, message: "Event created as a draft.", id: newId };
  } catch {
    return { ok: false, message: "Couldn't save. Check the database connection." };
  }
}

// Publish → flip status, then fire email + SMS notifications (idempotent).
export async function publishEvent(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await setEventStatus(id, "PUBLISHED");
  const ev = await getEvent(id);
  if (ev) {
    // Persist the broadcast outcome so staff see whether notifications actually
    // went out — not just that the status flipped to PUBLISHED.
    const r = await publishEventNotifications(ev, g.email ?? "system");
    await setEventNotify(id, { at: new Date().toISOString(), email: r.email, sms: r.sms });
  }
  refresh(id);
}

export async function cancelEvent(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (id) await setEventStatus(id, "CANCELLED");
  refresh(id);
}

export async function unpublishEvent(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (id) await setEventStatus(id, "DRAFT");
  refresh(id);
}

export async function removeEvent(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (id) await deleteEvent(id);
  refresh();
}

// Paste a forwarded email → AI draft to prefill the form. No infra (Phase 1).
export async function parsePastedEmail(formData: FormData): Promise<ParseState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const text = String(formData.get("emailText") ?? "").trim();
  if (text.length < 20) return { ok: false, message: "Paste the full event email first." };
  const draft = await parseForwardedEmail(text);
  if (!draft) return { ok: false, message: "Couldn't read that email. Add an AI key, or enter the event by hand." };
  return { ok: true, message: `Parsed (confidence ${(draft.confidence * 100).toFixed(0)}%). Review and save.`, draft };
}

// Regenerate one district's cached insight on demand (the cron does this nightly).
export async function generateInsight(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const key = String(formData.get("districtKey") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (key) await refreshDistrictInsight(key);
  refresh(id);
}
