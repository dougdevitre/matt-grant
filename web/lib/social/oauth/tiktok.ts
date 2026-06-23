import crypto from "node:crypto";
import { socialAppParam } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";
import type { OAuthProvider, AuthorizeResult, ExchangeResult } from "@/lib/social/oauth/types";

// TikTok OAuth2 Authorization Code + PKCE. Posting uses the Content Posting API, so
// the connect requests `video.publish` (which also covers photo posts). TikTok names
// the app id `client_key` (not client_id) and issues a rotating refresh token.
// NOTE: public DIRECT_POST requires the app to pass TikTok's audit and the pull-URL
// host to be domain-verified; until then posts must be SELF_ONLY (see publish.ts).

const SCOPES = "user.info.basic,video.publish";
const AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";
const USERINFO = "https://open.tiktokapis.com/v2/user/info/?fields=display_name";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function appCreds() {
  const [clientKey, clientSecret, redirectUri] = await Promise.all([
    socialAppParam("tiktok", "client_key"),
    socialAppParam("tiktok", "client_secret"),
    socialAppParam("tiktok", "redirect_uri"),
  ]);
  return { clientKey, clientSecret, redirectUri };
}

type TokenBody = { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string };

async function tokenRequest(params: Record<string, string>): Promise<{ ok: true; body: TokenBody } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching TikTok" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `TikTok token ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
  try {
    return { ok: true, body: JSON.parse(text) as TokenBody };
  } catch {
    return { ok: false, error: "unexpected TikTok token response" };
  }
}

export const tiktokProvider: OAuthProvider = {
  platform: "tiktok",

  async authorizeUrl(state): Promise<AuthorizeResult> {
    const { clientKey, redirectUri } = await appCreds();
    if (!clientKey || !redirectUri) return { ok: false, error: "TikTok client_key / redirect_uri are not set in Parameter Store." };
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const u = new URL(AUTHORIZE);
    u.searchParams.set("client_key", clientKey);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", SCOPES);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    return { ok: true, url: u.toString(), verifier };
  },

  async exchangeCode(code, verifier): Promise<ExchangeResult> {
    const { clientKey, clientSecret, redirectUri } = await appCreds();
    if (!clientKey || !clientSecret || !redirectUri) return { ok: false, error: "TikTok app credentials are not set." };
    if (!verifier) return { ok: false, error: "Missing PKCE verifier — try connecting again." };
    const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier, client_key: clientKey, client_secret: clientSecret });
    if (!tok.ok) return tok;
    if (!tok.body.access_token) return { ok: false, error: "TikTok returned no access token." };

    // Identify the connected account for display (non-fatal).
    let accountName: string | undefined;
    try {
      const me = await fetch(USERINFO, { headers: { authorization: `Bearer ${tok.body.access_token}` } });
      const body = (await me.json().catch(() => null)) as { data?: { user?: { display_name?: string } } } | null;
      accountName = body?.data?.user?.display_name ? `@${body.data.user.display_name}` : undefined;
    } catch {
      /* display only */
    }
    return {
      ok: true,
      conn: {
        platform: "tiktok",
        accessToken: tok.body.access_token,
        refreshToken: tok.body.refresh_token,
        accountName,
        expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
        scopes: SCOPES,
      },
    };
  },

  async refresh(conn): Promise<SocialConnection | null> {
    const { clientKey, clientSecret } = await appCreds();
    if (!clientKey || !clientSecret || !conn.refreshToken) return null;
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_key: clientKey, client_secret: clientSecret });
    if (!tok.ok || !tok.body.access_token) return null;
    return {
      ...conn,
      accessToken: tok.body.access_token,
      refreshToken: tok.body.refresh_token ?? conn.refreshToken, // TikTok rotates — keep the new one
      expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
    };
  },
};
