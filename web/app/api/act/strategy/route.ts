import { NextResponse } from "next/server";
import { generateStrategy, type StrategyInput } from "@/lib/strategy/engine";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { staffGate } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint for the /act campaign-action-plan tool. Anyone can request the
// PUBLIC teaser; the FULL depth (deeper strategy shown in the gated Peace Room)
// requires a signed-in staff/partner session — otherwise we clamp to public.
export async function POST(req: Request) {
  const rl = await rateLimit(`act:${clientIp(req)}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests — please slow down." }, { status: 429 });
  }

  let body: StrategyInput = {};
  try {
    body = (await req.json()) as StrategyInput;
  } catch {
    /* empty body → engine uses safe defaults */
  }

  // Gate the deeper output: only a valid session may request full depth.
  if (body.depth === "full") {
    const { ok } = await staffGate();
    if (!ok) body = { ...body, depth: "public" };
  }

  // generateStrategy never throws — it degrades to the curated, on-platform plan.
  const result = await generateStrategy(body);
  return NextResponse.json(result);
}
