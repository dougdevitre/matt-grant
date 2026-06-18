import { NextResponse } from "next/server";
import { runIngest } from "@/lib/integrations/legislative/ingest";

// Ingestion entrypoint. Triggered by Vercel Cron (GET) or a manual POST.
// Secured by CRON_SECRET — Vercel cron sends `Authorization: Bearer <CRON_SECRET>`.
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
  try {
    const counts = await runIngest();
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
