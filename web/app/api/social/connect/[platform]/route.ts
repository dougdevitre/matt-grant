import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { checkCap } from "@/lib/auth";
import { getProvider } from "@/lib/social/oauth";

// Start the in-admin OAuth connect flow for any registered provider (facebook —
// which also yields Instagram —, x, linkedin). Admin-only. Stores a CSRF state
// cookie, plus a PKCE verifier cookie when the provider uses one (X).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { allowed } = await checkCap("manageSocial");
  if (!allowed) return NextResponse.redirect(new URL("/dashboard?denied=manageSocial", req.url));

  const { platform } = await params;
  const provider = getProvider(platform);
  if (!provider) return NextResponse.redirect(new URL(`/dashboard/social?error=${encodeURIComponent(`Connect not available for ${platform}`)}`, req.url));

  const state = crypto.randomUUID();
  const auth = await provider.authorizeUrl(state);
  if (!auth.ok) return NextResponse.redirect(new URL(`/dashboard/social?error=${encodeURIComponent(auth.error)}`, req.url));

  const res = NextResponse.redirect(auth.url);
  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  res.cookies.set("social_oauth_state", `${platform}:${state}`, cookieOpts);
  if (auth.verifier) res.cookies.set("social_oauth_verifier", auth.verifier, cookieOpts);
  return res;
}
