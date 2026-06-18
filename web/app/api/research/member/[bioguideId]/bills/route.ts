import { NextResponse } from "next/server";
import { getBills } from "@/lib/integrations/legislative/store";
import { staffGate } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ bioguideId: string }> }) {
  if (!(await staffGate()).ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { bioguideId } = await params;
  const sp = new URL(req.url).searchParams;
  const relation = sp.get("relation") ?? undefined;
  const policyArea = sp.get("policyArea") ?? undefined;
  try {
    const bills = await getBills(bioguideId, { relation, policyArea });
    return NextResponse.json({ count: bills.length, bills });
  } catch {
    return NextResponse.json({ error: "research store unavailable" }, { status: 502 });
  }
}
