import { NextResponse } from "next/server";
import { buildLocalSnapshot } from "@/lib/issues/localSnapshot";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Layer A of the local-issue-intersection feature: return VERIFIED, CITED public
// figures for a ZIP, scoped to one issue's allow-list. No AI, no generated prose —
// buildLocalSnapshot only selects real Census figures and attaches citations, and
// fails closed to `null` on an invalid ZIP / Census error / an issue with no honest
// local hook. See web/docs/local-intersection/SPEC.md.
export async function POST(req: Request) {
  const rl = await rateLimit(`localsnap:${clientIp(req)}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  }

  let body: { issueSlug?: string; zip?: string } = {};
  try {
    body = (await req.json()) as { issueSlug?: string; zip?: string };
  } catch {
    /* empty/bad body → snapshot resolves to null below */
  }

  // buildLocalSnapshot never throws — it degrades to null.
  const snapshot = await buildLocalSnapshot(String(body.issueSlug ?? ""), body.zip);
  return NextResponse.json({ snapshot });
}
