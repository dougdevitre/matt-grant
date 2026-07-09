import crypto from "node:crypto";
import { getSecret } from "@/lib/ssm";
import { requestWithRetry } from "@/lib/integrations/http";
import { SITE_URL } from "@/lib/site";

// Twilio SMS via the campaign's approved Messaging Service. Graceful: if the creds
// aren't set the app still runs and callers no-op (mirrors lib/email/send.ts's
// `sesEnabled`). Uses the Twilio REST API over fetch — no SDK, consistent with the
// social publish adapters (lib/social/publish.ts). Creds resolve via getSecret
// (env-first → SSM /matt-grant/*), so they stay out of the build artifact.

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX), or null if unusable. */
export function toE164(raw?: string | null): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function creds(): Promise<{ sid?: string; token?: string; service?: string }> {
  const [sid, token, service] = await Promise.all([
    getSecret("TWILIO_ACCOUNT_SID"),
    getSecret("TWILIO_AUTH_TOKEN"),
    getSecret("TWILIO_MESSAGING_SERVICE_SID"),
  ]);
  return { sid, token, service };
}

/** True when Twilio is fully configured (account + token + messaging service). */
export async function smsEnabled(): Promise<boolean> {
  const c = await creds();
  return !!(c.sid && c.token && c.service);
}

/** Send one SMS through the Messaging Service. Graceful: returns sent:false (never throws). */
export async function sendSms(o: { to: string; body: string }): Promise<{ sent: boolean; sid?: string; error?: string }> {
  const to = toE164(o.to);
  if (!to) return { sent: false, error: "invalid phone number" };
  const c = await creds();
  if (!c.sid || !c.token || !c.service) return { sent: false, error: "Twilio not configured" };
  try {
    // Shared transport with retry: SAFE because Twilio creates a message only on a
    // 2xx — a non-2xx or network error means it was not created, so retrying a
    // transient failure can't double-send. requestWithRetry retries network/429/5xx
    // and returns 4xx (e.g. invalid number) immediately without retrying.
    const res = await requestWithRetry(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${c.sid}:${c.token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      // StatusCallback lets Twilio post delivery receipts (delivered/undelivered/failed)
      // to our signed status webhook, which reflects them on the 1:1 thread bubble.
      body: new URLSearchParams({
        MessagingServiceSid: c.service,
        To: to,
        Body: o.body,
        StatusCallback: `${SITE_URL}/api/webhooks/twilio/status`,
      }).toString(),
      timeoutMs: 10000,
      retries: 2,
      label: "twilio",
    });
    const data = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (!res.ok) return { sent: false, error: data?.message ?? `Twilio ${res.status}` };
    return { sent: true, sid: data?.sid };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

// Validate an inbound Twilio webhook (X-Twilio-Signature): HMAC-SHA1 over the full
// request URL with the POST params appended (sorted by key, concatenated key+value),
// base64, compared timing-safe to the header. Exported pure-ish for unit testing —
// pass the token explicitly so tests don't need SSM.
export function expectedTwilioSignature(token: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
}

export async function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): Promise<boolean> {
  const token = await getSecret("TWILIO_AUTH_TOKEN");
  if (!token || !signature) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedTwilioSignature(token, url, params));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
