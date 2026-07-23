import { type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { smsEnabled } from "@/lib/sms/send";
import { drainSmsOnce } from "@/lib/sms/campaigns";
import { SMS_DRAIN_BATCHES_PER_RUN } from "@/lib/sms/pacing";
import { jobOk, skipped, unauthorized } from "@/lib/jobResult";

// EventBridge hits this every minute (rate(1 minute)). Sends the next few bounded
// batches of queued SMS broadcasts. Mirrors /api/cron/email-drain. drainSmsOnce
// no-ops during quiet hours, so this is safe to fire around the clock.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Env-configurable (SMS_DRAIN_BATCHES_PER_RUN), bounded — default 3 × BATCH(10) = ~30 texts/invocation.
const MAX_BATCHES_PER_RUN = SMS_DRAIN_BATCHES_PER_RUN;

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
