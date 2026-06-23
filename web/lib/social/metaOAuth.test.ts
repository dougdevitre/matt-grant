import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authorizeUrl, exchangeCode, META_SCOPES } from "@/lib/social/metaOAuth";
import { _clearAppParamCache } from "@/lib/social/credentials";

function res(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) } as unknown as Response;
}

describe("Meta OAuth", () => {
  beforeEach(() => {
    // Env override stands in for /mattgrant/prod/social/facebook/* params.
    process.env.SOCIAL_FACEBOOK_APP_ID = "app123";
    process.env.SOCIAL_FACEBOOK_APP_SECRET = "secret456";
    process.env.SOCIAL_FACEBOOK_REDIRECT_URI = "https://mattgrantforcongress.org/api/social/callback/facebook";
    _clearAppParamCache();
  });
  afterEach(() => {
    delete process.env.SOCIAL_FACEBOOK_APP_ID;
    delete process.env.SOCIAL_FACEBOOK_APP_SECRET;
    delete process.env.SOCIAL_FACEBOOK_REDIRECT_URI;
    vi.restoreAllMocks();
  });

  it("builds an authorize URL with client_id, redirect, scopes, and state", async () => {
    const r = await authorizeUrl("st8");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.url);
    expect(u.searchParams.get("client_id")).toBe("app123");
    expect(u.searchParams.get("state")).toBe("st8");
    expect(u.searchParams.get("scope")).toBe(META_SCOPES);
    expect(u.searchParams.get("response_type")).toBe("code");
  });

  it("exchanges a code for a long-lived token + Page + linked IG account", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { access_token: "short1" })) // code → short token
      .mockResolvedValueOnce(res(200, { access_token: "long1", expires_in: 5184000 })) // → long token
      .mockResolvedValueOnce(
        res(200, { data: [{ id: "PID", name: "Matt Grant", access_token: "pagetok", instagram_business_account: { id: "IGID", username: "mattgrant" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const r = await exchangeCode("the-code");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.conn).toMatchObject({
      platform: "facebook",
      pageId: "PID",
      pageName: "Matt Grant",
      pageToken: "pagetok",
      igUserId: "IGID",
      igUsername: "mattgrant",
      userToken: "long1",
    });
    expect(r.conn.expiresAt).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails clearly when no manageable Page is returned", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { access_token: "short1" }))
      .mockResolvedValueOnce(res(200, { access_token: "long1" }))
      .mockResolvedValueOnce(res(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await exchangeCode("the-code");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Page/i);
  });
});

describe("socialAppParam env override", () => {
  afterEach(() => {
    delete process.env.SOCIAL_X_BEARER_TOKEN;
    _clearAppParamCache();
  });
  it("reads SOCIAL_<PLATFORM>_<FIELD> before touching SSM", async () => {
    const { socialAppParam } = await import("@/lib/social/credentials");
    process.env.SOCIAL_X_BEARER_TOKEN = "xyz";
    expect(await socialAppParam("x", "bearer_token")).toBe("xyz");
  });
});
