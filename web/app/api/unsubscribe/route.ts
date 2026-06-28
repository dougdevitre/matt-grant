import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubToken, suppress } from "@/lib/subscribers";
import { setVolunteerContactOptOut } from "@/lib/volunteers/optout";

// One-click unsubscribe endpoint targeted by the List-Unsubscribe header
// (RFC 8058). POST = mail-client one-click (no UI). GET = redirect to the
// human-facing /unsubscribe page (which also confirms). Public by design.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function unsub(token: string | null): Promise<boolean> {
  const email = token ? await verifyUnsubToken(token) : null;
  if (!email) return false;
  try {
    await suppress(email);
    await setVolunteerContactOptOut({ email }, true).catch(() => {}); // reflect on the roster
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ok = await unsub(req.nextUrl.searchParams.get("token"));
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  await unsub(token);
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token ?? "")}`, req.nextUrl.origin));
}
