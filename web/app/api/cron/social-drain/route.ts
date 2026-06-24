import { type NextRequest } from "next/server";
import { drainDue } from "@/lib/social/schedule";
import { refreshExpiring } from "@/lib/social/oauth/refresh";
import { dbConfigured } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobOk, jobFailed, skipped, unauthorized } from "@/lib/jobResult";

// Background worker for scheduled social posts. EventBridge calls this route via
// POST (only) with `Authorization: Bearer <CRON_SECRET>` — same secret + cadence as
// /api/cron/email-drain. Each run publishes any posts whose scheduled time has
// arrived: API channels auto-post, manual channels are staged "ready" in the UI.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) return unauthorized();
  if (!dbConfigured) return skipped("DB not configured");
  // Backstop: keep OAuth tokens fresh even without publishing traffic.
  const refresh = await refreshExpiring().catch(() => ({ checked: 0, refreshed: 0 }));
  try {
    const result = await drainDue();
    return jobOk({ ...result, refresh });
  } catch (e) {
    // Per-post failures are already isolated inside drainDue(); this catches a
    // batch-level failure (e.g. the initial query) so the worker returns a clean
    // 500 the scheduler can retry, with the cause in the logs.
    console.error("social-drain failed:", e);
    return jobFailed("drain failed", 500);
  }
}

export const POST = handle;
