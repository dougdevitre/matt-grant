import { NextResponse } from "next/server";
import { getMember } from "@/lib/integrations/legislative/store";
import { checkCap } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { type Provenance, ok, fail, degraded } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ bioguideId: string }> }) {
  if (!(await checkCap("viewResearch")).allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { bioguideId } = await params;
  const meta: Provenance = { source: `Congress.gov member ${bioguideId}`, kind: "api", live: true };
  if (!dbConfigured) return NextResponse.json(degraded(null, "research store not connected", meta));
  try {
    const member = await getMember(bioguideId);
    if (!member) return NextResponse.json(degraded(null, "not ingested yet", meta));
    return NextResponse.json(ok(member, { ...meta, count: 1 }));
  } catch {
    return NextResponse.json(fail("research store unavailable", meta), { status: 502 });
  }
}
