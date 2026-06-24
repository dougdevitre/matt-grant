import { type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { smsEnabled } from "@/lib/sms/send";
import { drainSmsOnce } from "@/lib/sms/campaigns";
import { jobOk, skipped, unauthorized } from "@/lib/jobResult";

// EventBridge hits this every minute (rate(1 minute)). Sends the next few bounded
// batches of queued SMS broadcasts. Mirrors /api/cron/email-drain. drainSmsOnce
// no-ops during quiet hours, so this is safe to fire around the clock.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BATCHES_PER_RUN = 3; // 3 × 10 = up to 30 texts/invocation

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) return unauthorized();
  if (!(await smsEnabled())) return skipped("Twilio not configured");

  const results: NonNullable<Awaited<ReturnType<typeof drainSmsOnce>>>[] = [];
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const r = await drainSmsOnce();
    if (!r) break; // nothing active, or quiet hours
    results.push(r);
    if (r.done) break;
  }
  return jobOk({ batches: results.length, results });
}

export const POST = handle;
