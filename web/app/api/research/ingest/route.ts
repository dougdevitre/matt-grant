import { NextResponse } from "next/server";
import { runFieldIngest } from "@/lib/integrations/research/ingestField";
import { fecEnabled } from "@/lib/integrations/fec/client";

// Ingestion entrypoint. Triggered by Vercel Cron (GET) or a manual POST.
// Secured by CRON_SECRET — Vercel cron sends `Authorization: Bearer <CRON_SECRET>`.
// Ingests the whole MO-02 primary field: roster + FEC money (all candidates) +
// federal record (Congress.gov + Clerk, sitting/former members only). Curated
// issue statements are config-driven and don't need ingestion.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run unauthenticated
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) {
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
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
