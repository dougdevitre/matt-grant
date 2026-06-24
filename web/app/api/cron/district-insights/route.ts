import { NextResponse, type NextRequest } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { refreshStaleInsights } from "@/lib/events/insights";

// Nightly (or on-demand) refresh of the cached per-district insight blurbs +
// demographics. Bearer-gated like the other cron workers. Census + Claude calls
// happen HERE so the dashboard never blocks a render on them. Logs a run row under
// PK.ingestRuns("district-insights"), mirroring the research ingest.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const startedAt = new Date().toISOString();
  try {
    const result = await refreshStaleInsights();
    if (dbConfigured) {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { PK: PK.ingestRuns("district-insights"), SK: startedAt, ok: true, startedAt, finishedAt: new Date().toISOString(), counts: result },
        }),
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (dbConfigured) {
      await ddb
        .send(
          new PutCommand({
            TableName: TABLE,
            Item: { PK: PK.ingestRuns("district-insights"), SK: startedAt, ok: false, startedAt, error: String(err) },
          }),
        )
        .catch(() => {});
    }
    return NextResponse.json({ ok: false, error: "refresh failed" }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
