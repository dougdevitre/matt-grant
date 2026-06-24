import { runFieldIngest } from "@/lib/integrations/research/ingestField";
import { fecEnabled } from "@/lib/integrations/fec/client";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobOk, jobFailed, skipped, unauthorized } from "@/lib/jobResult";

// Ingestion entrypoint. Triggered by Vercel Cron (GET) or a manual POST.
// Secured by CRON_SECRET — the scheduler sends `Authorization: Bearer <CRON_SECRET>`.
// Ingests the whole MO-02 primary field: roster + FEC money (all candidates) +
// federal record (Congress.gov + Clerk, sitting/former members only). Curated
// issue statements are config-driven and don't need ingestion.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: Request) {
  if (!(await cronAuthorized(req))) return unauthorized();
  // With no external keys the roster still persists, but enrichment no-ops
  // cleanly so the daily cron doesn't 502 every morning.
  const enriched = !!process.env.CONGRESS_GOV_API_KEY || fecEnabled;
  try {
    const counts = await runFieldIngest();
    return enriched ? jobOk({ counts }) : skipped("no CONGRESS_GOV_API_KEY / FEC_API_KEY — roster only", { counts });
  } catch (err) {
    console.error("[research/ingest]", err);
    return jobFailed("Ingest failed");
  }
}

export const GET = handle;
export const POST = handle;
