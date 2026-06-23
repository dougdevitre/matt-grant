import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { publishToChannel, verifyChannel } from "@/lib/social/publish";
import { _clearSecretCache } from "@/lib/ssm";

// YouTube renders a Short via ffmpeg; mock the render so CI never encodes video.
vi.mock("@/lib/social/video", () => ({ renderStillToMp4: vi.fn(async () => Buffer.from("FAKEMP4")) }));

// A resumable-session init response: 200 with a Location header pointing at the
// upload URL.
function sessionRes(location: string): Response {
  return { ok: true, status: 200, headers: { get: (k: string) => (k.toLowerCase() === "location" ? location : null) }, text: async () => "", json: async () => ({}) } as unknown as Response;
}

// Drive the real Facebook + Instagram adapters with a mocked fetch so the Graph
// API contract (endpoints, params, container→publish sequence, error handling) is
// verified without any live credentials or network. getSecret reads process.env
// first, so setting the env vars flips the channel to API mode in-test.

function res(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null }, // no x-restli-id by default; adapters fall back to the body
    text: async () => text,
    json: async () => JSON.parse(text),
  } as unknown as Response;
}

// An image-bytes response (for the media-fetch step of X uploads).
function imgRes(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "image/png" },
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response;
}

describe("X publisher (API v2)", () => {
  beforeEach(() => {
    process.env.X_ACCESS_TOKEN = "tkn";
    _clearSecretCache();
  });
  afterEach(() => {
    delete process.env.X_ACCESS_TOKEN;
    vi.restoreAllMocks();
  });

  it("posts text only with no media (single call to /2/tweets)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201, { data: { id: "tw_1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("x", { caption: "Vote Aug 4", hashtags: ["#MO02"] });
    expect(r).toMatchObject({ ok: true, mode: "api", externalId: "tw_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/2/tweets");
  });

  it("uploads media then attaches media_ids to the tweet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imgRes()) // fetch image bytes
      .mockResolvedValueOnce(res(200, { data: { id: "media_9" } })) // X media upload
      .mockResolvedValueOnce(res(201, { data: { id: "tw_2" } })); // create tweet
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("x", { caption: "Hi", hashtags: [], mediaUrl: "https://cdn.example.com/x.png" });
    expect(r).toMatchObject({ ok: true, externalId: "tw_2" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/2/media/upload");
    const tweetBody = String((fetchMock.mock.calls[2][1] as RequestInit).body);
    expect(tweetBody).toContain("media_9");
  });

  it("fails the post (no silent text-only) when media upload errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imgRes())
      .mockResolvedValueOnce(res(400, { title: "bad media" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("x", { caption: "Hi", hashtags: [], mediaUrl: "https://cdn.example.com/x.png" });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2); // never reached /2/tweets
  });
});

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

describe("LinkedIn publisher (UGC)", () => {
  beforeEach(() => {
    process.env.LINKEDIN_ACCESS_TOKEN = "tkn";
    process.env.LINKEDIN_AUTHOR_URN = "urn:li:organization:42";
    _clearSecretCache();
  });
  afterEach(() => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_AUTHOR_URN;
    vi.restoreAllMocks();
  });

  it("posts a UGC share as the configured author and returns the share id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(201, { id: "urn:li:share:7" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("linkedin", { caption: "Vote Aug 4", hashtags: ["#MO02"] });
    expect(r).toMatchObject({ ok: true, mode: "api", externalId: "urn:li:share:7" });
    expect(fetchMock.mock.calls[0][0]).toContain("/v2/ugcPosts");
    const body = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain("urn:li:organization:42");
    expect(body).toContain("PUBLISHED");
  });

  it("surfaces a LinkedIn API error as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(401, { message: "expired" })));
    const r = await publishToChannel("linkedin", { caption: "Hi", hashtags: [] });
    expect(r.ok).toBe(false);
  });

  it("registers + uploads an image, then references the asset in the share", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { value: { asset: "urn:li:digitalmediaAsset:AAA", uploadMechanism: { "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl: "https://upload.linkedin.example/abc" } } } })) // registerUpload
      .mockResolvedValueOnce(imgRes()) // fetch image bytes
      .mockResolvedValueOnce(res(201, {})) // PUT bytes
      .mockResolvedValueOnce(res(201, { id: "urn:li:share:9" })); // ugcPosts
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("linkedin", { caption: "Hi", hashtags: ["#MO02"], mediaUrl: "https://cdn.example.com/x.png" });
    expect(r).toMatchObject({ ok: true, externalId: "urn:li:share:9" });
    expect(fetchMock.mock.calls[0][0]).toContain("registerUpload");
    const ugcBody = String((fetchMock.mock.calls[3][1] as RequestInit).body);
    expect(ugcBody).toContain("urn:li:digitalmediaAsset:AAA");
    expect(ugcBody).toContain("IMAGE");
  });
});

describe("Threads publisher (Meta Graph, graph.threads.net)", () => {
  beforeEach(() => {
    process.env.THREADS_ACCESS_TOKEN = "tkn";
    process.env.THREADS_USER_ID = "th1";
    _clearSecretCache();
  });
  afterEach(() => {
    delete process.env.THREADS_ACCESS_TOKEN;
    delete process.env.THREADS_USER_ID;
    vi.restoreAllMocks();
  });

  it("posts a text-only thread: TEXT container then publish", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { id: "container_1" })) // create container
      .mockResolvedValueOnce(res(200, { id: "th_9" })); // publish
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("threads", { caption: "Vote Aug 4", hashtags: ["#MO02"] });
    expect(r).toMatchObject({ ok: true, mode: "api", externalId: "th_9" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://graph.threads.net/v1.0/th1/threads");
    expect(String((fetchMock.mock.calls[0][1] as RequestInit).body)).toContain("media_type=TEXT");
    expect(fetchMock.mock.calls[1][0]).toBe("https://graph.threads.net/v1.0/th1/threads_publish");
    expect(String((fetchMock.mock.calls[1][1] as RequestInit).body)).toContain("creation_id=container_1");
  });

  it("posts an IMAGE thread, rewriting a relative graphic to an absolute image_url", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(res(200, { id: "container_2" }))
      .mockResolvedValueOnce(res(200, { id: "th_10" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("threads", { caption: "Hi", hashtags: [], mediaUrl: "/api/graphics?format=ig_square" });
    expect(r).toMatchObject({ ok: true, externalId: "th_10" });
    const body = decodeURIComponent(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body).toContain("media_type=IMAGE");
    expect(body).toContain("https://mattgrantforcongress.org/api/graphics");
  });

  it("surfaces a container error as a failure (no publish call)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(res(400, { error: { message: "bad" } }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("threads", { caption: "Hi", hashtags: [] });
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never reached threads_publish
  });
});

describe("YouTube publisher (Shorts, resumable upload)", () => {
  beforeEach(() => {
    process.env.YOUTUBE_ACCESS_TOKEN = "tkn";
    _clearSecretCache();
  });
  afterEach(() => {
    delete process.env.YOUTUBE_ACCESS_TOKEN;
    delete process.env.YOUTUBE_PRIVACY_STATUS;
    vi.restoreAllMocks();
  });

  it("renders the Short, initiates a resumable session, and PUTs the bytes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sessionRes("https://upload.youtube/session-1")) // initiate
      .mockResolvedValueOnce(res(200, { id: "vid_1" })); // PUT bytes
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("youtube", { caption: "Vote Aug 4\nsecond line", hashtags: ["#MO02"], mediaUrl: "https://cdn.example.com/x.png" });
    expect(r).toMatchObject({ ok: true, mode: "api", externalId: "vid_1" });
    expect(fetchMock.mock.calls[0][0]).toContain("/upload/youtube/v3/videos?uploadType=resumable");
    const meta = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(meta.snippet.title).toContain("#Shorts");
    expect(meta.status.privacyStatus).toBe("private"); // safe default pre-verification
    expect(fetchMock.mock.calls[1][0]).toBe("https://upload.youtube/session-1");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PUT");
  });

  it("refuses to publish without a graphic and makes no API call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await publishToChannel("youtube", { caption: "Hi", hashtags: [] });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a resumable-init error as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res(403, { error: { message: "not verified" } })));
    const r = await publishToChannel("youtube", { caption: "Hi", hashtags: [], mediaUrl: "https://cdn.example.com/x.png" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("403");
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
