"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  createEvent, updateEvent, setEventStatus, deleteEvent, getEvent,
  isEventType, type EventType, type EventLocation,
} from "@/lib/events";
import { localCentralToIso } from "@/lib/events/time";
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

function readForm(f: FormData): { ok: boolean; type: EventType; location: EventLocation; start: string; end: string | null; title: string; description: string; capacity: number | null } {
  const title = String(f.get("title") ?? "").trim();
  const rawType = String(f.get("type") ?? "other");
  const start = localCentralToIso(String(f.get("start") ?? ""));
  const endLocal = String(f.get("end") ?? "").trim();
  const end = endLocal ? localCentralToIso(endLocal) : null;
  const capRaw = String(f.get("capacity") ?? "").trim();
  const capacity = capRaw ? Math.max(0, Number(capRaw) || 0) : null;
  return {
    ok: !!title && !!start,
    title,
    type: isEventType(rawType) ? rawType : "other",
    start,
    end,
    description: String(f.get("description") ?? "").trim(),
    capacity,
    location: {
      name: String(f.get("locName") ?? "").trim(),
      address: String(f.get("locAddress") ?? "").trim(),
      city: String(f.get("locCity") ?? "").trim(),
      county: String(f.get("locCounty") ?? "").trim(),
    },
  };
}

// Create or update (hidden `id` distinguishes). Returns state for the client form.
export async function saveEvent(formData: FormData): Promise<EventState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const id = String(formData.get("id") ?? "").trim();
  const d = readForm(formData);
  if (!d.ok) return { ok: false, message: "A title and start date/time are required." };

  try {
    if (id) {
      const okUpd = await updateEvent(id, {
        title: d.title, type: d.type, start: d.start, end: d.end,
        location: d.location, description: d.description, capacity: d.capacity, createdBy: g.email ?? "system",
      });
      if (!okUpd) return { ok: false, message: "Event not found." };
      refresh(id);
      return { ok: true, message: "Saved.", id };
    }
    const newId = await createEvent({
      title: d.title, type: d.type, start: d.start, end: d.end,
      location: d.location, description: d.description, capacity: d.capacity,
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
  if (ev) await publishEventNotifications(ev, g.email ?? "system");
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
