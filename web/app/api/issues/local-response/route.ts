import { NextResponse } from "next/server";
import { buildLocalSnapshot } from "@/lib/issues/localSnapshot";
import { generateLocalResponse, localResponseEnabled } from "@/lib/issues/localResponse";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Layer B: the generated "how Matt responds" note. GATED — returns null unless
// LOCAL_RESPONSE_ENABLED=1, so the feature stays dark until sign-off (SPEC §8). When
// enabled, generateLocalResponse maps the verified snapshot to Matt's documented
// commitment, guard-validates, and falls back to curated on any violation.
export async function POST(req: Request) {
  if (!localResponseEnabled()) return NextResponse.json({ response: null });

  const rl = await rateLimit(`localresp:${clientIp(req)}`, { limit: 15, windowSec: 60 });
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });

  let body: { issueSlug?: string; zip?: string } = {};
  try {
    body = (await req.json()) as { issueSlug?: string; zip?: string };
  } catch {
    /* bad body → null snapshot → curated */
  }

  const snapshot = await buildLocalSnapshot(String(body.issueSlug ?? ""), body.zip);
  const response = await generateLocalResponse(String(body.issueSlug ?? ""), snapshot);
  return NextResponse.json({ response });
}
