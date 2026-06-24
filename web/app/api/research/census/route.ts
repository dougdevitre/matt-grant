import { NextResponse } from "next/server";
import { fetchMo02Acs, censusEnabled } from "@/lib/integrations/census/client";
import { loadApi } from "@/lib/data/api";

// MO-02 county demographics (Census ACS 5-year) for map/targeting. Public data;
// read-only. Returns a Resource envelope — no key degrades to an empty payload
// (the API still works at low volume without one, so `enabled` only flags it).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await loadApi<unknown[]>(() => fetchMo02Acs(), {
    source: "Census ACS (MO-02 counties)",
    // Census works keyless at low volume; treat "no key" as enabled but noted.
    enabled: true,
    fallback: [],
  });
  // Surface whether a key is configured for any future consumer.
  const body = { ...res, meta: { ...res.meta, keyed: censusEnabled } };
  return NextResponse.json(body, {
    status: res.ok ? 200 : 502,
    headers: { "cache-control": "public, max-age=3600" },
  });
}
