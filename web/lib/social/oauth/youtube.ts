import crypto from "node:crypto";
import { socialAppParam } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";
import type { OAuthProvider, AuthorizeResult, ExchangeResult } from "@/lib/social/oauth/types";

// YouTube via Google OAuth2 (Authorization Code + PKCE). `access_type=offline` +
// `prompt=consent` are REQUIRED to receive a refresh token. Google does NOT rotate
// the refresh token, so we keep the original across refreshes. Uploading needs the
// restricted `youtube.upload` scope (Google app verification gate — see
// docs/google-youtube-setup.md).

const SCOPES = "https://www.googleapis.com/auth/youtube.upload openid email";
const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CHANNELS = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function appCreds() {
  const [clientId, clientSecret, redirectUri] = await Promise.all([
    socialAppParam("youtube", "client_id"),
    socialAppParam("youtube", "client_secret"),
    socialAppParam("youtube", "redirect_uri"),
  ]);
  return { clientId, clientSecret, redirectUri };
}

type TokenBody = { access_token?: string; refresh_token?: string; expires_in?: number };

async function tokenRequest(params: Record<string, string>): Promise<{ ok: true; body: TokenBody } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching Google" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `Google token ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
  try {
    return { ok: true, body: JSON.parse(text) as TokenBody };
  } catch {
    return { ok: false, error: "unexpected Google token response" };
  }
}

export const youtubeProvider: OAuthProvider = {
  platform: "youtube",

  async authorizeUrl(state): Promise<AuthorizeResult> {
    const { clientId, redirectUri } = await appCreds();
    if (!clientId || !redirectUri) return { ok: false, error: "YouTube client_id / redirect_uri are not set in Parameter Store." };
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const u = new URL(AUTHORIZE);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", SCOPES);
    u.searchParams.set("state", state);
    u.searchParams.set("access_type", "offline"); // → refresh token
    u.searchParams.set("prompt", "consent"); // force the refresh token even on re-consent
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    return { ok: true, url: u.toString(), verifier };
  },

  async exchangeCode(code, verifier): Promise<ExchangeResult> {
    const { clientId, clientSecret, redirectUri } = await appCreds();
    if (!clientId || !clientSecret || !redirectUri) return { ok: false, error: "YouTube app credentials are not set." };
    if (!verifier) return { ok: false, error: "Missing PKCE verifier — try connecting again." };
    const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier, client_id: clientId, client_secret: clientSecret });
    if (!tok.ok) return tok;
    if (!tok.body.access_token) return { ok: false, error: "Google returned no access token." };

    // Resolve the channel title for display (non-fatal).
    let accountName: string | undefined;
    try {
      const ch = await fetch(CHANNELS, { headers: { authorization: `Bearer ${tok.body.access_token}` } });
      const body = (await ch.json().catch(() => null)) as { items?: { snippet?: { title?: string } }[] } | null;
      accountName = body?.items?.[0]?.snippet?.title;
    } catch {
      /* display only */
    }
    return {
      ok: true,
      conn: {
        platform: "youtube",
        accessToken: tok.body.access_token,
        refreshToken: tok.body.refresh_token,
        accountName,
        expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
        scopes: SCOPES,
      },
    };
  },

  async refresh(conn): Promise<SocialConnection | null> {
    const { clientId, clientSecret } = await appCreds();
    if (!clientId || !clientSecret || !conn.refreshToken) return null;
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: clientId, client_secret: clientSecret });
    if (!tok.ok || !tok.body.access_token) return null;
    return {
      ...conn,
      accessToken: tok.body.access_token,
      refreshToken: conn.refreshToken, // Google does not rotate the refresh token
      expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
    };
  },
};
