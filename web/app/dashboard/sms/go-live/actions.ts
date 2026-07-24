"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { smsEnabled, sendSms, toE164 } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";
import { runSmsEnrichment } from "@/lib/reports/smsEnrichmentRun";

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

export type RunEnrichmentState = { ok: boolean; message: string };

// One-click enrichment from the console — the dashboard equivalent of
// `npm run enrich:sms` / the nightly cron, so staff can re-tag the opted-in ledger
// with the latest voter scores + ballot returns without a shell. Admin-only
// (manageTeam — the same gate as the go-live page it lives on). Reuses the shared
// orchestration; the returned summary is counts-only, never PII. Enrichment writes
// nothing until the voter file is ingested, so the button is disabled in the UI
// until then and this is a no-op-safe fallback if it's somehow invoked earlier.
export async function runEnrichmentNow(): Promise<RunEnrichmentState> {
  const g = await staffGate();
  if (!g.ok || !can(g.role, "manageTeam")) return { ok: false, message: "Only admins can run enrichment." };
  try {
    const s = await runSmsEnrichment();
    revalidatePath("/dashboard/sms/go-live");
    revalidatePath("/dashboard/sms");
    return {
      ok: true,
      message: `Tagged ${s.written}/${s.totalWrites} opted-in numbers — ${s.voterMatchedTags} matched to a voter score, ${s.contactZipOnlyTags} geo-only, across ${s.optedIn} opted-in. Reload to see the priority groups.`,
    };
  } catch (e) {
    return { ok: false, message: `Couldn't enrich: ${e instanceof Error ? e.message : "unknown error"}.` };
  }
}
