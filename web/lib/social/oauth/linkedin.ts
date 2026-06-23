import { socialAppParam } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";
import type { OAuthProvider, AuthorizeResult, ExchangeResult } from "@/lib/social/oauth/types";

// LinkedIn OAuth2. Ships MEMBER posting first (urn:li:person via OpenID userinfo);
// org posting is a follow-up the schema already supports. Member refresh tokens are
// only issued to approved apps — if absent, we degrade to reconnect-on-expiry.

const SCOPES = "openid profile w_member_social";
const AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO = "https://api.linkedin.com/v2/userinfo";

async function appCreds() {
  const [clientId, clientSecret, redirectUri] = await Promise.all([
    socialAppParam("linkedin", "client_id"),
    socialAppParam("linkedin", "client_secret"),
    socialAppParam("linkedin", "redirect_uri"),
  ]);
  return { clientId, clientSecret, redirectUri };
}

type TokenBody = { access_token?: string; refresh_token?: string; expires_in?: number };

async function tokenRequest(params: Record<string, string>): Promise<{ ok: true; body: TokenBody } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching LinkedIn" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `LinkedIn token ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
  try {
    return { ok: true, body: JSON.parse(text) as TokenBody };
  } catch {
    return { ok: false, error: "unexpected LinkedIn token response" };
  }
}

export const linkedinProvider: OAuthProvider = {
  platform: "linkedin",

  async authorizeUrl(state): Promise<AuthorizeResult> {
    const { clientId, redirectUri } = await appCreds();
    if (!clientId || !redirectUri) return { ok: false, error: "LinkedIn client_id / redirect_uri are not set in Parameter Store." };
    const u = new URL(AUTHORIZE);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", SCOPES);
    u.searchParams.set("state", state);
    return { ok: true, url: u.toString() };
  },

  async exchangeCode(code): Promise<ExchangeResult> {
    const { clientId, clientSecret, redirectUri } = await appCreds();
    if (!clientId || !clientSecret || !redirectUri) return { ok: false, error: "LinkedIn app credentials are not set." };
    const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret });
    if (!tok.ok) return tok;
    if (!tok.body.access_token) return { ok: false, error: "LinkedIn returned no access token." };

    // Resolve the author URN (and display name) via OpenID userinfo.
    let authorUrn: string | undefined;
    let accountName: string | undefined;
    try {
      const ui = await fetch(USERINFO, { headers: { authorization: `Bearer ${tok.body.access_token}` } });
      const body = (await ui.json().catch(() => null)) as { sub?: string; name?: string } | null;
      if (body?.sub) authorUrn = `urn:li:person:${body.sub}`;
      accountName = body?.name;
    } catch {
      /* fall through to the error below */
    }
    if (!authorUrn) return { ok: false, error: "Could not resolve your LinkedIn member id (userinfo)." };

    return {
      ok: true,
      conn: {
        platform: "linkedin",
        accessToken: tok.body.access_token,
        refreshToken: tok.body.refresh_token,
        authorUrn,
        accountName,
        expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
        scopes: SCOPES,
      },
    };
  },

  async refresh(conn): Promise<SocialConnection | null> {
    const { clientId, clientSecret } = await appCreds();
    if (!clientId || !clientSecret || !conn.refreshToken) return null; // not approved for refresh → reconnect on expiry
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: clientId, client_secret: clientSecret });
    if (!tok.ok || !tok.body.access_token) return null;
    return {
      ...conn,
      accessToken: tok.body.access_token,
      refreshToken: tok.body.refresh_token ?? conn.refreshToken,
      expiresAt: tok.body.expires_in ? new Date(Date.now() + tok.body.expires_in * 1000).toISOString() : undefined,
    };
  },
};
