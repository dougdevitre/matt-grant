import { smsEnabled, sendSms, toE164 } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";
import { isBlocked } from "@/lib/sms/moderation";
import { logOutbound } from "@/lib/sms/conversations";
import { withCompliance } from "@/lib/sms/templates";
import { withinSendWindow } from "@/lib/sms/campaigns";

export type LifecycleResult = { sent: boolean; reason?: string };

// Send a single automated, transactional text to a person at a lifecycle moment (volunteer
// signup welcome, donation thank-you, task assignment, etc.). Self-gating so callers can
// fire-and-forget: it no-ops unless texting is configured AND the number is opted-in AND not
// blocked. Adds the compliance suffix (sender ID + STOP) and logs to the 1:1 inbox thread so
// staff can follow up. Best-effort; never throws.
//
// Quiet hours (deliberate split): a CONFIRMATION of something the person just did (donation
// thank-you, signup welcome — like the inbound-keyword auto-reply) sends immediately, because
// the person is actively engaged at that moment. A STAFF-INITIATED text (task assignment) must
// pass `respectQuietHours: true` so it only goes out 9am–8pm CT (withinSendWindow) — outside
// the window it is SKIPPED (best-effort, not queued).
export async function sendLifecycleText(input: {
  to: string;
  body: string;
  by?: string;
  respectQuietHours?: boolean;
}): Promise<LifecycleResult> {
  try {
    const e = toE164(input.to);
    const text = input.body.trim();
    if (!e || !text) return { sent: false, reason: "missing number or body" };
    if (input.respectQuietHours && !withinSendWindow()) return { sent: false, reason: "quiet hours (9am-8pm CT)" };
    if (!(await smsEnabled())) return { sent: false, reason: "texting not configured" };
    if (!(await isOptedIn(e))) return { sent: false, reason: "not opted in" };
    if (await isBlocked(e)) return { sent: false, reason: "blocked" };

    const body = withCompliance(text);
    const r = await sendSms({ to: e, body });
    await logOutbound({ to: e, body, sid: r.sid, status: r.sent ? "sent" : "failed", by: input.by ?? "system" });
    return r.sent ? { sent: true } : { sent: false, reason: r.error };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
