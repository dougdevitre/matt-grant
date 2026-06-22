import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { drainDue } from "@/lib/social/schedule";
import { refreshExpiring } from "@/lib/social/oauth/refresh";
import { dbConfigured } from "@/lib/db";
import { getSecret } from "@/lib/ssm";

// Background worker for scheduled social posts. Point an EventBridge Scheduler
// (every ~1 min) at this route with `Authorization: Bearer <CRON_SECRET>` — the
// same secret + cadence as /api/cron/email-drain. Each run publishes any posts
// whose scheduled time has arrived: API channels auto-post, manual channels are
// staged "ready" for a human in the Command Center.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = await getSecret("CRON_SECRET");
  if (!secret) return false; // fail closed
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!dbConfigured) return NextResponse.json({ ok: true, skipped: "DB not configured" });
  // Backstop: keep OAuth tokens fresh even without publishing traffic.
  const refresh = await refreshExpiring().catch(() => ({ checked: 0, refreshed: 0 }));
  const result = await drainDue();
  return NextResponse.json({ ok: true, ...result, refresh });
}

export const POST = handle;
export const GET = handle;
