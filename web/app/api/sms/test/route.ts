import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { sendSms, smsEnabled, toE164 } from "@/lib/sms/send";
import { isOptedIn } from "@/lib/sms/consent";

// Manual test-send for the Twilio Messaging Service — a scriptable way to fire a single
// real text (e.g. to smoke-test creds on the deployed app once they're in SSM), separate
// from the SMS dashboard/composer at /dashboard/sms. Protected by the same CRON_SECRET
// bearer as the cron drains (lib/cron-auth.ts):
//   curl -X POST https://<site>/api/sms/test \
//     -H "Authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' \
//     -d '{"to":"+13145550100","body":"Test. Reply STOP to opt out."}'
// Consent-gated: refuses any number that isn't recorded opted-in (TCPA — don't text
// un-consented numbers, even for a test). Opt your own number in first by texting the
// keyword (default MATT) to the campaign number.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!(await smsEnabled())) {
    return NextResponse.json({ ok: false, error: "Twilio not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { to?: string; body?: string } | null;
  const to = toE164(body?.to);
  const text = body?.body?.trim();
  if (!to) return NextResponse.json({ ok: false, error: "invalid or missing 'to' (E.164)" }, { status: 400 });
  if (!text) return NextResponse.json({ ok: false, error: "missing 'body'" }, { status: 400 });

  if (!(await isOptedIn(to))) {
    return NextResponse.json(
      { ok: false, error: `${to} is not opted in — text the opt-in keyword to the campaign number first, then retry` },
      { status: 409 },
    );
  }

  const result = await sendSms({ to, body: text });
  return NextResponse.json({ ok: result.sent, ...result }, { status: result.sent ? 200 : 502 });
}
