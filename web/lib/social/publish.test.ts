import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { publishToChannel, verifyChannel } from "@/lib/social/publish";
import { _clearSecretCache } from "@/lib/ssm";

// Drive the real Facebook + Instagram adapters with a mocked fetch so the Graph
// API contract (endpoints, params, container→publish sequence, error handling) is
// verified without any live credentials or network. getSecret reads process.env
// first, so setting the env vars flips the channel to API mode in-test.

function res(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) } as unknown as Response;
}

describe("Facebook publisher (Meta Graph)", () => {
  beforeEach(() => {
    process.env.FACEBOOK_PAGE_TOKEN = "tkn";
    process.env.FACEBOOK_PAGE_ID = "pg1";
    _clearSecretCache();
  });
  afterEach(() => {
    delete process.env.FACEBOOK_PAGE_TOKEN;
    delete process.env.FACEBOOK_PAGE_ID;
    vi.restoreAllMocks();
  });

  it("posts a photo to {page}/photos when media is attached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { id: "post_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("facebook", { caption: "Hi", hashtags: ["#MO02"], mediaUrl: "https://cdn.example.com/x.png" });
    expect(r).toMatchObject({ ok: true, mode: "api", externalId: "post_1" });
    expect(fetchMock.mock.calls[0][0]).toContain("/pg1/photos");
    const body = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain("url=");
    expect(body).toContain("caption=");
  });

  it("posts to {page}/feed (message + link) when there's no image", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(200, { id: "feed_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("facebook", { caption: "Hi", hashtags: [], link: "https://site/act" });
    expect(r).toMatchObject({ ok: true, externalId: "feed_1" });
    expect(fetchMock.mock.calls[0][0]).toContain("/pg1/feed");
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain("message=");
  });

  it("surfaces a Meta error as a failure, never a silent OK", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(400, { error: { message: "bad token" } })));
    const r = await publishToChannel("facebook", { caption: "Hi", hashtags: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("400");
  });
});

describe("Instagram publisher (Meta Graph)", () => {
  beforeEach(() => {
    process.env.INSTAGRAM_ACCESS_TOKEN = "tkn";
    process.env.INSTAGRAM_USER_ID = "ig1";
    _clearSecretCache();
  });
  afterEach(() => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_USER_ID;
    vi.restoreAllMocks();
  });

  it("creates a media container then publishes it, rewriting a relative graphic to absolute", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { id: "container_1" }))
      .mockResolvedValueOnce(res(200, { id: "media_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("instagram", { caption: "Hi", hashtags: ["#MO02"], mediaUrl: "/api/graphics?format=ig_square" });
    expect(r).toMatchObject({ ok: true, mode: "api", externalId: "media_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/ig1/media");
    expect(decodeURIComponent(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toContain("https://mattgrantforcongress.org/api/graphics");
    expect(fetchMock.mock.calls[1][0]).toContain("/ig1/media_publish");
    expect(String((fetchMock.mock.calls[1][1] as RequestInit).body)).toContain("creation_id=container_1");
  });

  it("refuses to publish without an image and makes no API call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("instagram", { caption: "Hi", hashtags: [] });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("channel staging without credentials", () => {
  it("stages manually (not error) when a channel is unconfigured", async () => {
    const r = await publishToChannel("facebook", { caption: "Hi", hashtags: [] });
    expect(r).toEqual({ ok: true, mode: "manual" });
  });

  it("verifyChannel reports manual mode when unconfigured", async () => {
    const s = await verifyChannel("instagram");
    expect(s.mode).toBe("manual");
    expect(s.ok).toBe(true);
  });
});
