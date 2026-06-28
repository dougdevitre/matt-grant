import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getSecret } from "@/lib/ssm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-contained Airtable create — the games feature owns its capture path rather than
// coupling to the broader dashboard Airtable client, so it ships independently. Token
// is env-first then SSM (/matt-grant/AIRTABLE_API_KEY). Returns the HTTP status so the
// caller can map an unconfigured token (no key) to an honest 503.
async function airtableCreate(
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>,
): Promise<{ ok: boolean; status: number }> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return { ok: false, status: 503 };
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ typecast: true, records: [{ fields }] }),
  });
  return { ok: res.ok, status: res.status };
}

// Optional post-game email/SMS opt-in. TCPA: a phone is stored ONLY with explicit
// sms_consent === true (mirrors the issue-board submission consent rule). PII leaves
// the browser only here, never on the leaderboard. The destination Airtable base/table
// are config (GAMES_LEAD_BASE_ID / GAMES_LEAD_TABLE_ID via env or SSM) so the receiving
// base + retention window stay an ops decision, not a code constant.

const LeadSchema = z
  .object({
    gameId: z.string().min(1).max(40),
    score: z.number().int().nonnegative().optional(),
    email: z.string().email().optional(),
    phone: z.string().min(7).max(20).optional(),
    smsConsent: z.boolean().optional(),
    utmCampaign: z.string().max(80).optional(),
  })
  .strict()
  .refine((d) => d.email || d.phone, "provide an email or phone")
  .refine((d) => !d.phone || d.smsConsent === true, "phone requires sms_consent");

export async function POST(req: Request) {
  const rl = await rateLimit(`games-lead:${clientIp(req)}`, { limit: 8, windowSec: 3600 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many submissions — please try again later." }, { status: 429 });
  }

  let body: z.infer<typeof LeadSchema>;
  try {
    body = LeadSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid opt-in — check your email/phone and consent." }, { status: 400 });
  }

  const baseId = await getSecret("GAMES_LEAD_BASE_ID");
  const tableId = await getSecret("GAMES_LEAD_TABLE_ID");
  if (!baseId || !tableId) {
    // Capture target not configured yet — honest 503 rather than a silent drop.
    return NextResponse.json({ error: "Opt-in is not available right now." }, { status: 503 });
  }

  let result: { ok: boolean; status: number };
  try {
    result = await airtableCreate(baseId, tableId, {
      "Game": body.gameId,
      "Score": body.score ?? null,
      "Email": body.email ?? "",
      "Phone": body.smsConsent ? (body.phone ?? "") : "", // never store a phone without consent
      "SMS Opt-In": Boolean(body.smsConsent),
      "Source": "games-subdomain",
      "UTM Campaign": body.utmCampaign ?? "four-fights",
    });
  } catch {
    return NextResponse.json({ error: "Could not save your opt-in. Please try again." }, { status: 502 });
  }

  if (result.status === 503) {
    return NextResponse.json({ error: "Opt-in is not available right now." }, { status: 503 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: "Could not save your opt-in. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
