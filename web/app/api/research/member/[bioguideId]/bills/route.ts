import { NextResponse } from "next/server";
import { getBills } from "@/lib/integrations/legislative/store";
import { checkCap } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { type Provenance, ok, fail, degraded } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ bioguideId: string }> }) {
  if (!(await checkCap("viewResearch")).allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { bioguideId } = await params;
  const sp = new URL(req.url).searchParams;
  const relation = sp.get("relation") ?? undefined;
  const policyArea = sp.get("policyArea") ?? undefined;
  const meta: Provenance = { source: `Bills ${bioguideId}`, kind: "api", live: true };
  if (!dbConfigured) return NextResponse.json(degraded([], "research store not connected", meta));
  try {
    const bills = await getBills(bioguideId, { relation, policyArea });
    return NextResponse.json(ok(bills, { ...meta, count: bills.length }));
  } catch {
    return NextResponse.json(fail("research store unavailable", meta), { status: 502 });
  }
}
