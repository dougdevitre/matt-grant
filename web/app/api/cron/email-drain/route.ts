import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { drainOnce } from "@/lib/campaigns";
import { sesEnabled } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";

// Background worker for queued email campaigns. Point an EventBridge Scheduler
// (every ~1 min) at this route with `Authorization: Bearer <CRON_SECRET>`. Each
// invocation drains a few bounded batches, so delivery progresses steadily
// without any single request approaching the timeout.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCHES_PER_RUN = 4; // 4 × 25 = up to 100 sends/invocation

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!sesEnabled) return NextResponse.json({ ok: true, skipped: "SES not configured" });

  const host = req.headers.get("host");
  const base = host ? `https://${host}` : SITE_URL;

  const results: NonNullable<Awaited<ReturnType<typeof drainOnce>>>[] = [];
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const r = await drainOnce(base);
    if (!r) break; // nothing active
    results.push(r);
    if (r.done) break; // finished the current campaign; next run takes the next one
  }
  return NextResponse.json({ ok: true, batches: results.length, results });
}

export const POST = handle;
export const GET = handle;
