import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runFieldIngest } from "@/lib/integrations/research/ingestField";
import { fecEnabled } from "@/lib/integrations/fec/client";
import { getSecret } from "@/lib/ssm";

// Ingestion entrypoint. Triggered by Vercel Cron (GET) or a manual POST.
// Secured by CRON_SECRET — Vercel cron sends `Authorization: Bearer <CRON_SECRET>`.
// Ingests the whole MO-02 primary field: roster + FEC money (all candidates) +
// federal record (Congress.gov + Clerk, sitting/former members only). Curated
// issue statements are config-driven and don't need ingestion.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorized(req: Request): Promise<boolean> {
  const secret = await getSecret("CRON_SECRET"); // env-first; SSM once un-baked
  if (!secret) return false; // refuse to run unauthenticated
  // Constant-time compare so the secret can't be recovered byte-by-byte via
  // response timing (mirrors /api/cron/email-drain). H2.
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function handle(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized (set CRON_SECRET and send it as a bearer token)" }, { status: 401 });
  }
  // With no external keys the roster still persists, but enrichment no-ops
  // cleanly so the daily cron doesn't 502 every morning.
  const enriched = !!process.env.CONGRESS_GOV_API_KEY || fecEnabled;
  try {
    const counts = await runFieldIngest();
    return NextResponse.json(
      enriched ? { ok: true, counts } : { ok: true, skipped: "no CONGRESS_GOV_API_KEY / FEC_API_KEY — roster only", counts },
    );
  } catch (err) {
    console.error("[research/ingest]", err);
    return NextResponse.json({ ok: false, error: "Ingest failed" }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
