import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { publishToChannel, channelConfigured } from "@/lib/social/publish";
import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/social/channels";
import { _clearSecretCache } from "@/lib/ssm";

// Regression guard for the #69 class of bug: a channel flagged apiPublish:true but
// with no dispatch branch (its adapter was dropped) would silently hit the "not
// implemented" fallthrough and fail at publish. This test asserts every
// apiPublish:true channel actually reaches a real adapter. It complements the
// compile-time exhaustiveness guard in apiPublish() — belt and suspenders.

// YouTube renders via ffmpeg; mock it so this test never encodes video.
vi.mock("@/lib/social/video", () => ({ renderStillToMp4: vi.fn(async () => Buffer.from("FAKEMP4")) }));

// A generic response usable by any adapter — they each parse it differently and may
// error, but they must NOT return the "not implemented" fallthrough. A Location
// header is included so the YouTube resumable-init step finds its session URL.
function genericRes(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === "location" ? "https://upload.example/session" : null) },
    text: async () => "{}",
    json: async () => ({ id: "x", data: { id: "x", publish_id: "x", user: { display_name: "n" } }, items: [{ snippet: { title: "t" } }] }),
    arrayBuffer: async () => new ArrayBuffer(8),
  } as unknown as Response;
}

// Flat-name env creds that flip each channel into API mode via the fallback path.
const CREDS: Record<ChannelId, Record<string, string>> = {
  x: { X_ACCESS_TOKEN: "t" },
  facebook: { FACEBOOK_PAGE_TOKEN: "t", FACEBOOK_PAGE_ID: "p" },
  instagram: { INSTAGRAM_ACCESS_TOKEN: "t", INSTAGRAM_USER_ID: "i" },
  linkedin: { LINKEDIN_ACCESS_TOKEN: "t", LINKEDIN_AUTHOR_URN: "urn:li:person:1" },
  tiktok: { TIKTOK_ACCESS_TOKEN: "t" },
  youtube: { YOUTUBE_ACCESS_TOKEN: "t" },
  threads: { THREADS_ACCESS_TOKEN: "t", THREADS_USER_ID: "u" },
};

const touched: string[] = [];
function setCreds(ch: ChannelId) {
  for (const [k, v] of Object.entries(CREDS[ch])) {
    process.env[k] = v;
    touched.push(k);
  }
  _clearSecretCache();
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(genericRes()));
});
afterEach(() => {
  for (const k of touched.splice(0)) delete process.env[k];
  _clearSecretCache();
  vi.restoreAllMocks();
});

describe("adapter coverage: every apiPublish channel reaches a real adapter", () => {
  const apiChannels = CHANNEL_IDS.filter((ch) => CHANNELS[ch].apiPublish);

  it("has at least one apiPublish channel to check", () => {
    expect(apiChannels.length).toBeGreaterThan(0);
  });

  for (const ch of apiChannels) {
    it(`${ch} is configured and not the "not implemented" fallthrough`, async () => {
      setCreds(ch);
      expect(await channelConfigured(ch)).toBe(true);
      const r = await publishToChannel(ch, { caption: "hi", hashtags: ["#MO02"], mediaUrl: "https://cdn.example.com/x.png" });
      // The adapter may still error against the generic mocked response — that's
      // fine. It must never be the dispatch fallthrough.
      if (!r.ok) expect(r.error).not.toMatch(/not implemented/i);
    });
  }
});
