import { describe, it, expect, afterEach, vi } from "vitest";
import { publishToChannel, channelConfigured } from "@/lib/social/publish";
import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/social/channels";
import { _clearSecretCache } from "@/lib/ssm";

// Guard against the #69 class of regression: a channel flagged `apiPublish: true`
// whose dispatch branch is missing, so publishToChannel falls through to the "not
// implemented" error and the post fails at publish time. For every apiPublish
// channel we wire its flat-name credentials, then assert publishToChannel reaches a
// real adapter (never the fallthrough). The compile-time `never` guard in
// apiPublish() is the primary defense; this is the behavioral backstop.

// YouTube renders a Short via ffmpeg — mock the render so CI never encodes video.
vi.mock("@/lib/social/video", () => ({ renderStillToMp4: vi.fn(async () => Buffer.from("FAKEMP4")) }));

// A benign response; the per-channel adapters parse it differently, but none of
// them should return the "not implemented" fallthrough error.
function genericRes(): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === "location" ? "https://upload.example/session" : null) },
    text: async () => "{}",
    json: async () => ({ id: "x", data: { id: "x", publish_id: "x" } }),
  } as unknown as Response;
}

// Flat-name env credentials that flip each channel to API mode (the manual-token
// fallback in resolveCredentials).
const CREDS: Record<ChannelId, Record<string, string>> = {
  x: { X_ACCESS_TOKEN: "t" },
  facebook: { FACEBOOK_PAGE_TOKEN: "t", FACEBOOK_PAGE_ID: "p" },
  instagram: { INSTAGRAM_ACCESS_TOKEN: "t", INSTAGRAM_USER_ID: "i" },
  linkedin: { LINKEDIN_ACCESS_TOKEN: "t", LINKEDIN_AUTHOR_URN: "urn:li:person:1" },
  tiktok: { TIKTOK_ACCESS_TOKEN: "t" },
  youtube: { YOUTUBE_ACCESS_TOKEN: "t" },
  threads: { THREADS_ACCESS_TOKEN: "t", THREADS_USER_ID: "u" },
};

afterEach(() => {
  for (const env of Object.values(CREDS)) for (const k of Object.keys(env)) delete process.env[k];
  _clearSecretCache();
  vi.restoreAllMocks();
});

describe("every apiPublish channel reaches a real adapter (no 'not implemented' fallthrough)", () => {
  for (const ch of CHANNEL_IDS) {
    if (!CHANNELS[ch].apiPublish) continue;
    it(`${ch} is dispatched to an adapter`, async () => {
      for (const [k, v] of Object.entries(CREDS[ch])) process.env[k] = v;
      _clearSecretCache();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(genericRes()));

      expect(await channelConfigured(ch)).toBe(true); // creds resolved → API mode
      const r = await publishToChannel(ch, { caption: "hi", hashtags: ["#MO02"], mediaUrl: "https://cdn.example.com/x.png" });
      // A real adapter may still succeed or error on the mocked fetch — it just must
      // never be the dispatch fallthrough.
      if (!r.ok) expect(r.error).not.toMatch(/not implemented/i);
    });
  }
});
