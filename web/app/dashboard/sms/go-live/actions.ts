"use server";

import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled, sendSms, toE164 } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";

export type GoLiveTestState = { ok: boolean; message: string };

// In-console smoke test — the one-click equivalent of `curl … /api/sms/test`. Same
// guards, same order: admin (sendSms) → Twilio configured → valid E.164 → recorded
// opt-in (TCPA: never text an un-consented number, even for a test). Reuses sendSms
// so what lands here is exactly what a real send does.
export async function sendGoLiveTest(formData: FormData): Promise<GoLiveTestState> {
  const g = await staffGate();
  if (!g.ok || !can(g.role, "sendSms")) return { ok: false, message: "Only admins can send a test." };
  if (!(await smsEnabled())) return { ok: false, message: "Texting isn't configured yet (add the Twilio credentials above)." };

  const to = toE164(String(formData.get("to") ?? ""));
  if (!to) return { ok: false, message: "Enter a valid US mobile number, e.g. +13145551234." };
  if (!(await isOptedIn(to))) {
    return { ok: false, message: `${to} isn't opted in — text the opt-in keyword to the campaign number first, then retry.` };
  }

  const body = String(formData.get("body") ?? "").trim() || "Test from Matt Grant for Congress. Reply STOP to opt out.";
  const r = await sendSms({ to, body });
  return r.sent ? { ok: true, message: `Test sent to ${to}.` } : { ok: false, message: `Couldn't send: ${r.error ?? "unknown error"}.` };
}
