import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { checkCap } from "@/lib/auth";
import { authorizeUrl } from "@/lib/social/metaOAuth";

// Start the in-admin OAuth connect flow. Admin-only. Currently Meta ("facebook"),
// which also yields the linked Instagram business account. Sends the admin to the
// platform consent screen with a CSRF state stored in an httpOnly cookie.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { allowed } = await checkCap("manageSocial");
  if (!allowed) return NextResponse.redirect(new URL("/dashboard?denied=manageSocial", req.url));

  const { platform } = await params;
  if (platform !== "facebook") {
    return NextResponse.redirect(new URL(`/dashboard/social?error=${encodeURIComponent(`Connect not implemented for ${platform}`)}`, req.url));
  }

  const state = crypto.randomUUID();
  const auth = await authorizeUrl(state);
  if (!auth.ok) return NextResponse.redirect(new URL(`/dashboard/social?error=${encodeURIComponent(auth.error)}`, req.url));

  const res = NextResponse.redirect(auth.url);
  res.cookies.set("social_oauth_state", `${platform}:${state}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete consent
  });
  return res;
}
