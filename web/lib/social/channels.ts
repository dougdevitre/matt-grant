// Per-channel publishing schema for the Social Command Center. One source of
// truth for the limits, hashtag norms, image specs, and best-time windows the
// composer and the Profile Optimizer both read. Values verified against public
// 2026 platform docs (see web/docs/social-command-center.md for the dated
// sources); treat them as guidance, not a contract — platforms move these.
//
// Verified: 2026-06-22. Re-check before relying on a hard limit.

export type ChannelId = "x" | "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube" | "threads";

export type ChannelSpec = {
  id: ChannelId;
  label: string;
  /** Hard caption ceiling (characters). Posting beyond this fails on-platform. */
  maxChars: number;
  /** Characters shown in-feed before a "…more" truncation — front-load the hook. */
  feedTruncateChars: number;
  /** Recommended hashtag count [min, max] per current best practice. */
  recommendedHashtags: [number, number];
  /** Hard hashtag ceiling the platform enforces (0 = no fixed cap, use restraint). */
  maxHashtags: number;
  /** Default graphics-studio format id (see /api/graphics) for this channel's image. */
  imageFormat: string;
  /** Pixel target for the primary in-feed image. */
  imageSpec: { w: number; h: number };
  /** Best posting windows, US Central (MO-02 is Central). Illustrative, tune from data. */
  bestTimesCt: string[];
  /** Whether direct API auto-publish is wired (gated on tokens — see publish.ts). */
  apiPublish: boolean;
  /** Brand swatch for the channel chip. */
  color: string;
};

// The static SOCIAL_POSTS library uses "X" | "Facebook" | "Instagram"; map those
// display names onto channel ids so the existing 50-post calendar imports cleanly.
export const LEGACY_CHANNEL_MAP: Record<string, ChannelId> = {
  X: "x",
  Facebook: "facebook",
  Instagram: "instagram",
};

export const CHANNELS: Record<ChannelId, ChannelSpec> = {
  x: {
    id: "x",
    label: "X (Twitter)",
    maxChars: 280, // free accounts; Premium long-form is 25,000 but don't assume it
    feedTruncateChars: 280,
    recommendedHashtags: [1, 2],
    maxHashtags: 5,
    imageFormat: "x_header",
    imageSpec: { w: 1600, h: 900 },
    bestTimesCt: ["8:00 AM", "12:00 PM", "5:00 PM"],
    apiPublish: true,
    color: "#0F1419",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    maxChars: 5000, // practical page limit (full hard cap is far higher, ~63k)
    feedTruncateChars: 250,
    recommendedHashtags: [0, 2],
    maxHashtags: 10,
    imageFormat: "ig_square",
    imageSpec: { w: 1200, h: 1200 },
    bestTimesCt: ["9:00 AM", "1:00 PM", "7:00 PM"],
    apiPublish: true,
    color: "#1877F2",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    maxChars: 2200,
    feedTruncateChars: 125,
    recommendedHashtags: [3, 5],
    maxHashtags: 30, // hard platform cap on a grid post
    imageFormat: "ig_square",
    imageSpec: { w: 1080, h: 1080 },
    bestTimesCt: ["11:00 AM", "2:00 PM", "8:00 PM"],
    apiPublish: true,
    color: "#C13584",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    maxChars: 3000,
    feedTruncateChars: 210,
    recommendedHashtags: [3, 5],
    maxHashtags: 10,
    imageFormat: "web_banner",
    imageSpec: { w: 1200, h: 627 },
    bestTimesCt: ["7:30 AM", "12:00 PM", "5:30 PM"],
    apiPublish: true,
    color: "#0A66C2",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    maxChars: 4000, // 2026 caption ceiling
    feedTruncateChars: 100,
    recommendedHashtags: [3, 5],
    maxHashtags: 20,
    imageFormat: "ig_story",
    imageSpec: { w: 1080, h: 1920 },
    bestTimesCt: ["6:00 AM", "10:00 AM", "7:00 PM"],
    apiPublish: true,
    color: "#010101",
  },
  youtube: {
    id: "youtube",
    label: "YouTube (Shorts)",
    maxChars: 5000, // description; title is 100
    feedTruncateChars: 100,
    recommendedHashtags: [2, 3],
    maxHashtags: 15,
    imageFormat: "ig_story",
    imageSpec: { w: 1080, h: 1920 },
    bestTimesCt: ["12:00 PM", "3:00 PM", "8:00 PM"],
    apiPublish: false,
    color: "#FF0000",
  },
  threads: {
    id: "threads",
    label: "Threads",
    maxChars: 500,
    feedTruncateChars: 500,
    recommendedHashtags: [0, 1], // Threads supports one tag per post
    maxHashtags: 1,
    imageFormat: "ig_square",
    imageSpec: { w: 1080, h: 1080 },
    bestTimesCt: ["8:00 AM", "1:00 PM", "8:00 PM"],
    apiPublish: true,
    color: "#000000",
  },
};

export const CHANNEL_IDS = Object.keys(CHANNELS) as ChannelId[];

export function isChannelId(v: unknown): v is ChannelId {
  return typeof v === "string" && v in CHANNELS;
}

/** Coerce arbitrary input (incl. legacy "X"/"Facebook"/"Instagram") to ids. */
export function toChannelIds(values: unknown[]): ChannelId[] {
  const out = new Set<ChannelId>();
  for (const v of values) {
    if (isChannelId(v)) out.add(v);
    else if (typeof v === "string" && LEGACY_CHANNEL_MAP[v]) out.add(LEGACY_CHANNEL_MAP[v]);
  }
  return [...out];
}

/** Compose the full post text a channel will receive: caption + hashtag block. */
export function composeText(caption: string, hashtags: string[]): string {
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return tags ? `${caption.trim()}\n\n${tags}`.trim() : caption.trim();
}
