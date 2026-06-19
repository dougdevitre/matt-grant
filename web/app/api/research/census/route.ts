import { NextResponse } from "next/server";
import { fetchMo02Acs, censusEnabled } from "@/lib/integrations/census/client";

// MO-02 county demographics (Census ACS 5-year) for map/targeting. Public data;
// read-only. Returns live ACS rather than storing — small, cacheable payload.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const counties = await fetchMo02Acs();
    return NextResponse.json(
      { keyed: censusEnabled, generatedAt: new Date().toISOString(), counties },
      { headers: { "cache-control": "public, max-age=3600" } },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
