import { NextResponse } from "next/server";
import { getMember } from "@/lib/integrations/legislative/store";
import { checkCap } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { type Provenance, ok, fail, degraded } from "@/lib/data/resource";
import { preflight, withCors } from "@/lib/http/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extension: opposition-research member lookup. Same gate as the dashboard
// research surface — `viewResearch` (admin + captain). Hand-rolled (not extRoute)
// only because it takes a [bioguideId] param; the CORS + capability + Resource
// contract is identical.
export function OPTIONS(req: Request): Response {
  return preflight(req);
}

export async function GET(req: Request, { params }: { params: Promise<{ bioguideId: string }> }): Promise<Response> {
  const { allowed } = await checkCap("viewResearch");
  const { bioguideId } = await params;
  const meta: Provenance = { source: `Congress.gov member ${bioguideId}`, kind: "api", live: true };
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  if (!dbConfigured) return withCors(NextResponse.json(degraded(null, "research store not connected", meta)), req);
  try {
    const member = await getMember(bioguideId);
    if (!member) return withCors(NextResponse.json(degraded(null, "not ingested yet", meta)), req);
    return withCors(NextResponse.json(ok(member, { ...meta, count: 1 })), req);
  } catch {
    return withCors(NextResponse.json(fail("research store unavailable", meta), { status: 502 }), req);
  }
}
