"use server";

import { headers } from "next/headers";
import { rateLimit } from "@/lib/ratelimit";
import { staffGate } from "@/lib/auth";
import { saveVolunteerSignup, type IntakeResult } from "@/lib/volunteers/intake";
import { isJoinDoor, type JoinDoor } from "@/lib/volunteer/taxonomy";

// Per-IP throttle shared by the public (no-account) join forms.
async function throttle(bucket: string): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const rl = await rateLimit(`${bucket}:${ip}`, { limit: 10, windowSec: 3600 });
  return rl.allowed;
}

const SPAM = { ok: true, message: "Thank you! The campaign will be in touch soon." } as const;
const TOO_MANY: IntakeResult = {
  ok: false,
  message: "Too many submissions from this connection — please try again in a little while.",
};

// ── Get Updates — lightweight, no account ─────────────────────────────────────
export async function submitUpdates(_prev: IntakeResult | null, fd: FormData): Promise<IntakeResult> {
  if (String(fd.get("company") ?? "").trim()) return SPAM; // honeypot
  if (!(await throttle("join-updates"))) return TOO_MANY;
  return saveVolunteerSignup({
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? ""),
    phone: String(fd.get("phone") ?? ""),
    zip: String(fd.get("zip") ?? ""),
    smsOptIn: !!String(fd.get("smsOptIn") ?? "").trim(),
    door: "Get Updates",
  });
}

// ── Donor Pledge — lightweight; client redirects to WinRed on success ─────────
export async function submitPledge(_prev: IntakeResult | null, fd: FormData): Promise<IntakeResult> {
  if (String(fd.get("company") ?? "").trim()) return SPAM; // honeypot
  if (!(await throttle("join-pledge"))) return TOO_MANY;
  const amountRaw = Number(String(fd.get("pledgeAmount") ?? "").replace(/[^0-9.]/g, ""));
  return saveVolunteerSignup({
    name: String(fd.get("name") ?? ""),
    email: String(fd.get("email") ?? ""),
    pledgeAmount: Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null,
    door: "Donor Pledge",
  });
}

// ── Volunteer / Team Captain — requires a signed-in Clerk account ─────────────
// The page route is gated in middleware; the email is taken from the session
// (never the form) so a signup always writes the authenticated user's own record.
export async function submitVolunteerDetail(_prev: IntakeResult | null, fd: FormData): Promise<IntakeResult> {
  const doorRaw = String(fd.get("door") ?? "Volunteer");
  const door: JoinDoor = isJoinDoor(doorRaw) && (doorRaw === "Volunteer" || doorRaw === "Team Captain") ? doorRaw : "Volunteer";

  const { email } = await staffGate();
  const formEmail = String(fd.get("email") ?? "").trim();
  const useEmail = email || formEmail; // session first; form only as a demo/keyless fallback
  if (!useEmail) {
    return { ok: false, message: "Please sign in (or add your email) so we can connect your account." };
  }

  return saveVolunteerSignup({
    name: String(fd.get("name") ?? ""),
    email: useEmail,
    phone: String(fd.get("phone") ?? ""),
    city: String(fd.get("city") ?? ""),
    zip: String(fd.get("zip") ?? ""),
    door,
    commitmentLevel: door === "Team Captain" ? "Core" : String(fd.get("commitmentLevel") ?? ""),
    roleInterests: fd.getAll("roleInterests").map(String),
    skills: fd.getAll("skills").map(String),
    mode: String(fd.get("mode") ?? ""),
    availability: fd.getAll("availability").map(String),
    captainNote: door === "Team Captain" ? String(fd.get("captainNote") ?? "") : null,
    message: String(fd.get("message") ?? ""),
  });
}
