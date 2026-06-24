import { type NextRequest } from "next/server";
import { drainOnce } from "@/lib/campaigns";
import { sesEnabled } from "@/lib/email/send";
import { SITE_URL } from "@/lib/site";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobOk, skipped, unauthorized } from "@/lib/jobResult";

// Background worker for queued email campaigns. EventBridge calls this route via
// POST (only) with `Authorization: Bearer <CRON_SECRET>`. Each invocation drains a
// few bounded batches, so delivery progresses steadily without any single request
// approaching the timeout.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCHES_PER_RUN = 4; // 4 × 25 = up to 100 sends/invocation

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) return unauthorized();
  if (!sesEnabled) return skipped("SES not configured");

  const host = req.headers.get("host");
  const base = host ? `https://${host}` : SITE_URL;

  const results: NonNullable<Awaited<ReturnType<typeof drainOnce>>>[] = [];
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const r = await drainOnce(base);
    if (!r) break; // nothing active
    results.push(r);
    if (r.done) break; // finished the current campaign; next run takes the next one
  }
  return jobOk({ batches: results.length, results });
}

export const POST = handle;
