import { NextResponse, type NextRequest } from "next/server";
import { checkCap } from "@/lib/auth";
import { exchangeCode } from "@/lib/social/metaOAuth";
import { saveConnection } from "@/lib/social/connections";

// OAuth callback for the connect flow. Verifies the CSRF state cookie, exchanges
// the code for a long-lived token + the Page/IG account, and stores the
// connection. The platform's registered redirect_uri must point here
// (…/api/social/callback/facebook).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (req: NextRequest, q: string) => NextResponse.redirect(new URL(`/dashboard/social?${q}`, req.url));

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { allowed, gate } = await checkCap("manageSocial");
  if (!allowed) return NextResponse.redirect(new URL("/dashboard?denied=manageSocial", req.url));

  const { platform } = await params;
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(req, `error=${encodeURIComponent(sp.get("error_description") || sp.get("error") || "denied")}`);

  // CSRF: the cookie holds "<platform>:<state>" and must match the query state.
  const cookie = req.cookies.get("social_oauth_state")?.value ?? "";
  const [cookiePlatform, cookieState] = cookie.split(":");
  const state = sp.get("state");
  if (!state || cookiePlatform !== platform || cookieState !== state) return back(req, "error=Invalid+or+expired+state.+Try+connecting+again.");

  const code = sp.get("code");
  if (!code) return back(req, "error=No+authorization+code+returned.");
  if (platform !== "facebook") return back(req, `error=${encodeURIComponent(`Callback not implemented for ${platform}`)}`);

  const result = await exchangeCode(code);
  if (!result.ok) return back(req, `error=${encodeURIComponent(result.error)}`);

  await saveConnection({ ...result.conn, connectedBy: gate.email ?? "admin", connectedAt: new Date().toISOString() });

  const res = back(req, `connected=facebook`);
  res.cookies.set("social_oauth_state", "", { path: "/", maxAge: 0 }); // clear
  return res;
}
