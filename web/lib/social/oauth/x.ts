import crypto from "node:crypto";
import { socialAppParam } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";
import type { OAuthProvider, AuthorizeResult, ExchangeResult } from "@/lib/social/oauth/types";

// X (Twitter) OAuth2 Authorization Code + PKCE. offline.access is REQUIRED to get
// a refresh token; X rotates the refresh token on every refresh, so we persist the
// new one each time. Confidential client → HTTP Basic auth on the token endpoint.

const SCOPES = "tweet.read tweet.write users.read offline.access";
const AUTHORIZE = "https://twitter.com/i/oauth2/authorize";
const TOKEN = "https://api.twitter.com/2/oauth2/token";
const ME = "https://api.twitter.com/2/users/me";

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function appCreds() {
  const [clientId, clientSecret, redirectUri] = await Promise.all([
    socialAppParam("x", "client_id"),
    socialAppParam("x", "client_secret"),
    socialAppParam("x", "redirect_uri"),
  ]);
  return { clientId, clientSecret, redirectUri };
}

// POST the token endpoint (authorization_code or refresh_token) with Basic auth.
async function tokenRequest(params: Record<string, string>, clientId: string, clientSecret: string): Promise<{ ok: true; body: TokenBody } | { ok: false; error: string }> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(TOKEN, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching X" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `X token ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
  try {
    return { ok: true, body: JSON.parse(text) as TokenBody };
  } catch {
    return { ok: false, error: "unexpected X token response" };
  }
}

type TokenBody = { access_token?: string; refresh_token?: string; expires_in?: number };

export const xProvider: OAuthProvider = {
  platform: "x",

  async authorizeUrl(state): Promise<AuthorizeResult> {
    const { clientId, redirectUri } = await appCreds();
    if (!clientId || !redirectUri) return { ok: false, error: "X client_id / redirect_uri are not set in Parameter Store." };
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const u = new URL(AUTHORIZE);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", SCOPES);
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", challenge);
    u.searchParams.set("code_challenge_method", "S256");
    return { ok: true, url: u.toString(), verifier };
  },

  async exchangeCode(code, verifier): Promise<ExchangeResult> {
    const { clientId, clientSecret, redirectUri } = await appCreds();
    if (!clientId || !clientSecret || !redirectUri) return { ok: false, error: "X app credentials are not set." };
    if (!verifier) return { ok: false, error: "Missing PKCE verifier — try connecting again." };
    const tok = await tokenRequest(
      { grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier, client_id: clientId },
      clientId,
      clientSecret,
    );
    if (!tok.ok) return tok;
    if (!tok.body.access_token) return { ok: false, error: "X returned no access token." };

    // Identify the connected account for display.
    let accountName: string | undefined;
    try {
      const me = await fetch(ME, { headers: { authorization: `Bearer ${tok.body.access_token}` } });
      const body = (await me.json().catch(() => null)) as { data?: { username?: string } } | null;
      accountName = body?.data?.username ? `@${body.data.username}` : undefined;
    } catch {
      /* display only */
    }
    return {
      ok: true,
      conn: {
        platform: "x",
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
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: clientId }, clientId, clientSecret);
    if (!tok.ok || !tok.body.access_token) return null;
    return {
      ...conn,
      accessToken: tok.body.access_token,
      refreshToken: tok.body.refresh_token ?? conn.refreshToken, // X rotates — keep the new one
      expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
    };
  },
};
