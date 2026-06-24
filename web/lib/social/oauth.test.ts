import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { xProvider } from "@/lib/social/oauth/x";
import { linkedinProvider } from "@/lib/social/oauth/linkedin";
import { tiktokProvider } from "@/lib/social/oauth/tiktok";
import { youtubeProvider } from "@/lib/social/oauth/youtube";
import { ensureFresh } from "@/lib/social/oauth/refresh";
import { CONNECTABLE_PLATFORMS } from "@/lib/social/oauth";
import { CONNECT_PLATFORMS } from "@/lib/social/connect-platforms";
import { _clearAppParamCache } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";

function res(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) } as unknown as Response;
}

describe("connect UI ↔ OAuth registry sync", () => {
  // Guards the gap found in the scan: #68/#69 registered tiktok/youtube providers but
  // the connections panel only listed facebook/x/linkedin. If a provider is added to
  // the registry (or removed) without updating the connect UI's platform list, this
  // fails — so every connectable provider always has a Connect button, and vice-versa.
  it("every registered OAuth provider is surfaced as a Connect option (and vice-versa)", () => {
    expect([...CONNECT_PLATFORMS].sort()).toEqual([...CONNECTABLE_PLATFORMS].sort());
  });
});

describe("X provider (OAuth2 + PKCE)", () => {
  beforeEach(() => {
    process.env.SOCIAL_X_CLIENT_ID = "xid";
    process.env.SOCIAL_X_CLIENT_SECRET = "xsecret";
    process.env.SOCIAL_X_REDIRECT_URI = "https://mattgrantforcongress.org/api/social/callback/x";
    _clearAppParamCache();
  });
  afterEach(() => {
    delete process.env.SOCIAL_X_CLIENT_ID;
    delete process.env.SOCIAL_X_CLIENT_SECRET;
    delete process.env.SOCIAL_X_REDIRECT_URI;
    vi.restoreAllMocks();
  });

  it("builds a PKCE authorize URL and returns the verifier", async () => {
    const r = await xProvider.authorizeUrl("st");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.url);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toBeTruthy();
    expect(u.searchParams.get("scope")).toContain("offline.access");
    expect(r.verifier).toBeTruthy();
  });

  it("exchanges a code for access+refresh tokens and the @handle", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { access_token: "at", refresh_token: "rt", expires_in: 7200 }))
      .mockResolvedValueOnce(res(200, { data: { username: "mattgrant" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await xProvider.exchangeCode("code", "verifier");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conn).toMatchObject({ platform: "x", accessToken: "at", refreshToken: "rt", accountName: "@mattgrant" });
    expect(r.conn.expiresAt).toBeTruthy();
  });

  it("refresh rotates the refresh token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { access_token: "at2", refresh_token: "rt2", expires_in: 7200 })));
    const conn = { platform: "x", accessToken: "old", refreshToken: "rt1", connectedBy: "a", connectedAt: "x" } as SocialConnection;
    const updated = await xProvider.refresh!(conn);
    expect(updated?.accessToken).toBe("at2");
    expect(updated?.refreshToken).toBe("rt2");
  });

  it("fails the exchange without a PKCE verifier", async () => {
    const r = await xProvider.exchangeCode("code", undefined);
    expect(r.ok).toBe(false);
  });
});

describe("LinkedIn provider (OAuth2)", () => {
  beforeEach(() => {
    process.env.SOCIAL_LINKEDIN_CLIENT_ID = "lid";
    process.env.SOCIAL_LINKEDIN_CLIENT_SECRET = "lsecret";
    process.env.SOCIAL_LINKEDIN_REDIRECT_URI = "https://mattgrantforcongress.org/api/social/callback/linkedin";
    _clearAppParamCache();
  });
  afterEach(() => {
    delete process.env.SOCIAL_LINKEDIN_CLIENT_ID;
    delete process.env.SOCIAL_LINKEDIN_CLIENT_SECRET;
    delete process.env.SOCIAL_LINKEDIN_REDIRECT_URI;
    vi.restoreAllMocks();
  });

  it("builds an authorize URL with member scope", async () => {
    const r = await linkedinProvider.authorizeUrl("st");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(new URL(r.url).searchParams.get("scope")).toContain("w_member_social");
  });

  it("honors a scopes override (e.g. adding org posting after CMA approval)", async () => {
    process.env.SOCIAL_LINKEDIN_SCOPES = "openid profile w_member_social w_organization_social";
    _clearAppParamCache();
    try {
      const r = await linkedinProvider.authorizeUrl("st");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(new URL(r.url).searchParams.get("scope")).toContain("w_organization_social");
    } finally {
      delete process.env.SOCIAL_LINKEDIN_SCOPES;
      _clearAppParamCache();
    }
  });

  it("exchanges a code and resolves the author URN via userinfo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { access_token: "at", expires_in: 5184000 }))
      .mockResolvedValueOnce(res(200, { sub: "ABC123", name: "Matt Grant" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await linkedinProvider.exchangeCode("code");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conn).toMatchObject({ platform: "linkedin", accessToken: "at", authorUrn: "urn:li:person:ABC123", accountName: "Matt Grant" });
  });
});

describe("TikTok provider (OAuth2 + PKCE)", () => {
  beforeEach(() => {
    process.env.SOCIAL_TIKTOK_CLIENT_KEY = "tkkey";
    process.env.SOCIAL_TIKTOK_CLIENT_SECRET = "tksecret";
    process.env.SOCIAL_TIKTOK_REDIRECT_URI = "https://mattgrantforcongress.org/api/social/callback/tiktok";
    _clearAppParamCache();
  });
  afterEach(() => {
    delete process.env.SOCIAL_TIKTOK_CLIENT_KEY;
    delete process.env.SOCIAL_TIKTOK_CLIENT_SECRET;
    delete process.env.SOCIAL_TIKTOK_REDIRECT_URI;
    vi.restoreAllMocks();
  });

  it("builds a PKCE authorize URL with client_key and video.publish scope", async () => {
    const r = await tiktokProvider.authorizeUrl("st");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.url);
    expect(u.searchParams.get("client_key")).toBe("tkkey");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).toContain("video.publish");
    expect(r.verifier).toBeTruthy();
  });

  it("exchanges a code for tokens and the @display_name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { access_token: "at", refresh_token: "rt", expires_in: 86400, open_id: "oid" }))
      .mockResolvedValueOnce(res(200, { data: { user: { display_name: "MattGrant" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await tiktokProvider.exchangeCode("code", "verifier");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conn).toMatchObject({ platform: "tiktok", accessToken: "at", refreshToken: "rt", accountName: "@MattGrant" });
  });

  it("fails the exchange without a PKCE verifier", async () => {
    const r = await tiktokProvider.exchangeCode("code", undefined);
    expect(r.ok).toBe(false);
  });
});

describe("YouTube provider (Google OAuth2 + PKCE)", () => {
  beforeEach(() => {
    process.env.SOCIAL_YOUTUBE_CLIENT_ID = "yid";
    process.env.SOCIAL_YOUTUBE_CLIENT_SECRET = "ysecret";
    process.env.SOCIAL_YOUTUBE_REDIRECT_URI = "https://mattgrantforcongress.org/api/social/callback/youtube";
    _clearAppParamCache();
  });
  afterEach(() => {
    delete process.env.SOCIAL_YOUTUBE_CLIENT_ID;
    delete process.env.SOCIAL_YOUTUBE_CLIENT_SECRET;
    delete process.env.SOCIAL_YOUTUBE_REDIRECT_URI;
    vi.restoreAllMocks();
  });

  it("builds an offline PKCE authorize URL with the youtube.upload scope", async () => {
    const r = await youtubeProvider.authorizeUrl("st");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.url);
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("scope")).toContain("youtube.upload");
    expect(r.verifier).toBeTruthy();
  });

  it("exchanges a code for tokens and the channel title", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { access_token: "at", refresh_token: "rt", expires_in: 3600 }))
      .mockResolvedValueOnce(res(200, { items: [{ snippet: { title: "Matt Grant for Congress" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await youtubeProvider.exchangeCode("code", "verifier");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conn).toMatchObject({ platform: "youtube", accessToken: "at", refreshToken: "rt", accountName: "Matt Grant for Congress" });
  });

  it("refresh keeps the original refresh token (Google does not rotate)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { access_token: "at2", expires_in: 3600 })));
    const conn = { platform: "youtube", accessToken: "old", refreshToken: "rt1", connectedBy: "a", connectedAt: "x" } as SocialConnection;
    const updated = await youtubeProvider.refresh!(conn);
    expect(updated?.accessToken).toBe("at2");
    expect(updated?.refreshToken).toBe("rt1");
  });

  it("fails the exchange without a PKCE verifier", async () => {
    const r = await youtubeProvider.exchangeCode("code", undefined);
    expect(r.ok).toBe(false);
  });
});

describe("ensureFresh", () => {
  afterEach(() => {
    delete process.env.SOCIAL_X_CLIENT_ID;
    delete process.env.SOCIAL_X_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it("refreshes a connection within the 7-day skew", async () => {
    process.env.SOCIAL_X_CLIENT_ID = "xid";
    process.env.SOCIAL_X_CLIENT_SECRET = "xsecret";
    _clearAppParamCache();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(200, { access_token: "fresh", refresh_token: "rt2", expires_in: 7200 })));
    const soon = new Date(Date.now() + 2 * 86400000).toISOString(); // 2 days out → within skew
    const conn = { platform: "x", accessToken: "stale", refreshToken: "rt1", expiresAt: soon, connectedBy: "a", connectedAt: "x" } as SocialConnection;
    const out = await ensureFresh(conn);
    expect(out.accessToken).toBe("fresh");
  });

  it("leaves a long-lived (no-expiry) connection untouched", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const conn = { platform: "facebook", pageToken: "pt", pageId: "pg", connectedBy: "a", connectedAt: "x" } as SocialConnection;
    const out = await ensureFresh(conn);
    expect(out).toBe(conn);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
