import { NextResponse } from "next/server";
import { getVotes } from "@/lib/integrations/legislative/store";
import { staffGate } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { type Provenance, ok, fail, degraded } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ bioguideId: string }> }) {
  if (!(await staffGate()).ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { bioguideId } = await params;
  const sp = new URL(req.url).searchParams;
  const year = sp.get("year") ? Number(sp.get("year")) : undefined;
  const position = sp.get("position") ?? undefined;
  const meta: Provenance = { source: `Votes ${bioguideId}`, kind: "api", live: true };
  if (!dbConfigured) return NextResponse.json(degraded([], "research store not connected", meta));
  try {
    const votes = await getVotes(bioguideId, { year, position });
    return NextResponse.json(ok(votes, { ...meta, count: votes.length }));
  } catch {
    return NextResponse.json(fail("research store unavailable", meta), { status: 502 });
  }
}
