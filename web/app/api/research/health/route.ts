import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { getAllFecDetail, getAllNews, getAllFec } from "@/lib/integrations/research/store";
import { lastFieldIngest } from "@/lib/integrations/research/ingestField";
import { fieldFreshness } from "@/lib/integrations/research/freshness";

// Public canary: research-data freshness, derived from the data's own per-step
// timestamps (reliable even when a heavy ingest run never writes its ok:true
// end-record). Returns 200 when fresh and 503 when stale, so a plain HTTP uptime
// check (Route 53 health check / external monitor) alarms automatically with no
// extra wiring. No secrets, no PII — just timestamps and counts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!dbConfigured) {
    return NextResponse.json({ ok: true, configured: false, note: "store not configured" });
  }

  let detail: Awaited<ReturnType<typeof getAllFecDetail>> = {};
  let news: Awaited<ReturnType<typeof getAllNews>> = {};
  let fec: Awaited<ReturnType<typeof getAllFec>> = {};
  let run: Awaited<ReturnType<typeof lastFieldIngest>> = null;
  try {
    [detail, news, fec, run] = await Promise.all([getAllFecDetail(), getAllNews(), getAllFec(), lastFieldIngest()]);
  } catch {
    // Can't read the store → report unhealthy rather than silently green.
    return NextResponse.json({ ok: false, error: "store read failed" }, { status: 503 });
  }

  const fresh = fieldFreshness({ detail, news, fec, runAt: run?.startedAt ?? null });
  const ageDays = fresh.ageMs == null ? null : Math.round((fresh.ageMs / 86_400_000) * 10) / 10;
  return NextResponse.json(
    {
      ok: !fresh.stale,
      stale: fresh.stale,
      dataAsOf: fresh.latestAt,
      ageDays,
      candidatesWithDetail: Object.keys(detail).length,
      candidatesWithNews: Object.keys(news).length,
      lastRun: run ? { ok: run.ok, startedAt: run.startedAt } : null,
    },
    { status: fresh.stale ? 503 : 200 },
  );
}
