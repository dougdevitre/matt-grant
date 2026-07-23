import { type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { dbConfigured } from "@/lib/db";
import { runSmsEnrichment } from "@/lib/reports/smsEnrichmentRun";
import { jobOk, skipped, unauthorized, jobFailed } from "@/lib/jobResult";

// Nightly enrichment worker. EventBridge calls this route via POST with
// `Authorization: Bearer <CRON_SECRET>`. It re-tags each opted-in consent row with
// the denormalized voter fields (voterSegment/voterT/banked/county/zip) so the
// composer's priority presets + budget coverage reflect the latest scores and
// ballot returns — without anyone remembering to run `npm run enrich:sms` by hand.
// Reads voter data, so it lives OUTSIDE lib/sms/ (the TCPA isolation wall). The
// returned summary is counts-only — no phone number or name is ever emitted.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) return unauthorized();
  if (!dbConfigured) return skipped("DynamoDB not configured");
  try {
    const summary = await runSmsEnrichment();
    return jobOk({ summary });
  } catch (e) {
    return jobFailed(e instanceof Error ? e.message : "enrichment failed");
  }
}

export const POST = handle;
