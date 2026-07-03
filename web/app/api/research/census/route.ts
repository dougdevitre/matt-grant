import { NextResponse } from "next/server";
import { loadCensusCounties } from "@/lib/integrations/census/view";
import { censusEnabled } from "@/lib/integrations/census/client";

// MO-02 county demographics (Census ACS 5-year) for map/targeting. Public data;
// read-only. Returns a Resource envelope (shared with the dashboard read view via
// loadCensusCounties). No key degrades to an empty payload; `keyed` flags whether
// one is configured for any future consumer.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await loadCensusCounties();
  const body = { ...res, meta: { ...res.meta, keyed: censusEnabled } };
  return NextResponse.json(body, {
    status: res.ok ? 200 : 502,
    headers: { "cache-control": "public, max-age=3600" },
  });
}
