import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import { checkAirtableBaseHealth } from "@/lib/airtable/health";
import { type Provenance, ok, fail, degraded } from "@/lib/data/resource";

// Data-hub reachability probe for one Airtable base. Same gate as the data hub
// page itself (`viewResearch`), same Resource envelope every hub source returns,
// so a card can live-ping it via `checkable`. Not the extension surface — no
// CORS; this is a same-origin dashboard fetch carrying the Clerk cookie.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ base: string }> }): Promise<Response> {
  const { allowed } = await checkCap("viewResearch");
  const { base } = await params;
  const meta: Provenance = { source: `Airtable base ${base}`, kind: "airtable", live: true };

  if (!allowed) return NextResponse.json(fail("forbidden", meta), { status: 403 });
  if (!(base in AIRTABLE_BASES)) return NextResponse.json(fail(`unknown base "${base}"`, meta), { status: 404 });

  const health = await checkAirtableBaseHealth(base as keyof typeof AIRTABLE_BASES);
  switch (health.state) {
    case "live":
      return NextResponse.json(ok({ base, reachable: true }, { ...meta, count: 1, note: health.detail }));
    case "setup":
      // Missing key = degraded-but-usable (matches the app's "no creds → degraded" convention).
      return NextResponse.json(degraded({ base, reachable: false }, health.detail, meta));
    case "error":
    default:
      return NextResponse.json(fail(health.detail, meta), { status: 502 });
  }
}
