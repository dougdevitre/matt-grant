"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { addSignup, getEvent } from "@/lib/events";
import { rateLimit } from "@/lib/ratelimit";

export type RsvpState = { ok: boolean; message: string };

// Public RSVP — no auth. Rate-limited per IP so the embedded sign-up list can't be
// spammed. Appends to the event's signups[]; PII stays staff-only (the public page
// shows just a count).
export async function rsvp(formData: FormData): Promise<RsvpState> {
  const id = String(formData.get("eventId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { ok: false, message: "Please enter your name." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const rl = await rateLimit(`rsvp:${ip}`, { limit: 12, windowSec: 3600 });
  if (!rl.allowed) return { ok: false, message: "Too many sign-ups from this connection — try again later." };

  const event = await getEvent(id);
  if (!event || event.status !== "PUBLISHED") return { ok: false, message: "This event isn't open for sign-ups." };

  const ok = await addSignup(id, {
    name,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    role: String(formData.get("role") ?? "").trim() || undefined,
    count: Number(formData.get("count") ?? 1) || 1,
  });
  if (!ok) return { ok: false, message: "Something went wrong — please try again." };

  revalidatePath(`/events/${id}`);
  revalidatePath(`/dashboard/events/${id}`);
  return { ok: true, message: "You're in — thanks! We'll be in touch with details." };
}
