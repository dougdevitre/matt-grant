import { NextResponse, type NextRequest } from "next/server";
import { checkCap } from "@/lib/auth";
import { getProvider } from "@/lib/social/oauth";
import { saveConnection } from "@/lib/social/connections";

// OAuth callback for any registered provider. Verifies the CSRF state cookie,
// exchanges the code (with the PKCE verifier when present), and stores the
// connection. The platform's registered redirect_uri must point here
// (…/api/social/callback/<platform>).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/dashboard/social?${q}`, req.url));

function clearCookies(res: NextResponse) {
  res.cookies.set("social_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("social_oauth_verifier", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { allowed, gate } = await checkCap("manageSocial");
  if (!allowed) return NextResponse.redirect(new URL("/dashboard?denied=manageSocial", req.url));

  const { platform } = await params;
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(req, `error=${encodeURIComponent(sp.get("error_description") || sp.get("error") || "denied")}`);

  const provider = getProvider(platform);
  if (!provider) return back(req, `error=${encodeURIComponent(`Callback not available for ${platform}`)}`);

  // CSRF: the cookie holds "<platform>:<state>" and must match the query state.
  const cookie = req.cookies.get("social_oauth_state")?.value ?? "";
  const [cookiePlatform, cookieState] = cookie.split(":");
  const state = sp.get("state");
  if (!state || cookiePlatform !== platform || cookieState !== state) return clearCookies(back(req, "error=Invalid+or+expired+state.+Try+connecting+again."));

  const code = sp.get("code");
  if (!code) return clearCookies(back(req, "error=No+authorization+code+returned."));

  const verifier = req.cookies.get("social_oauth_verifier")?.value;
  const result = await provider.exchangeCode(code, verifier);
  if (!result.ok) return clearCookies(back(req, `error=${encodeURIComponent(result.error)}`));

  await saveConnection({ ...result.conn, connectedBy: gate.email ?? "admin", connectedAt: new Date().toISOString() });
  return clearCookies(back(req, `connected=${platform}`));
}
