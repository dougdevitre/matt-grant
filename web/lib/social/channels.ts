// Per-channel publishing schema for the Social Command Center. One source of
// truth for the limits, hashtag norms, image specs, and best-time windows the
// composer and the Profile Optimizer both read. Values verified against public
// 2026 platform docs (see web/docs/social-command-center.md for the dated
// sources); treat them as guidance, not a contract — platforms move these.
//
// Verified: 2026-06-22. Re-check before relying on a hard limit.

import { CAMPAIGN } from "@/lib/site";

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
    // The Content Posting API caps a photo post's title/caption at 2200 chars and
    // publish.ts slices to 2200 before sending. renderChannelText MUST fit within
    // that so the trailing "Paid for by" disclaimer is never sliced off (a
    // compliance line, not optional). Do not raise above the adapter's slice.
    maxChars: 2200,
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
    apiPublish: true,
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

// ── Precise per-channel render ─────────────────────────────────────────────────
// The exact, final string to copy/paste (or auto-publish) for one channel: caption
// → CTA → hashtags → link → the FEC "Paid for by" disclaimer, fitted to the
// channel's hard character limit. The disclaimer is a legal requirement on public
// campaign communications (11 CFR 110.11) and is NEVER dropped or truncated — when
// space is tight the caption gives way first, then hashtags, so a fitted post is
// always compliant. Pure + deterministic (unit-tested in channels.test.ts).

export type RenderablePost = {
  caption: string;
  hashtags: string[];
  link?: string;
  cta?: string;
};

export type RenderedChannelText = {
  channel: ChannelId;
  text: string; // the exact string to paste
  chars: number;
  maxChars: number;
  fitted: boolean; // true when something had to be trimmed to fit
  droppedHashtags: number; // hashtags removed to make room
  notes: string[]; // channel guidance shown NEXT TO the text, never inside it
};

// Same CTA vocabulary the scorer uses, so we don't double-inject a CTA the caption
// already makes (keep in sync with optimize.ts CTA_HINTS).
const CTA_HINTS = ["donate", "volunteer", "vote", "join", "sign", "share", "learn", "rsvp", "chip in", "text", "call"];

const hashTag = (h: string) => (h.startsWith("#") ? h : `#${h}`);

/** Truncate to a whole-word boundary within `budget` chars, adding a trailing "...". */
function truncateWords(text: string, budget: number): string {
  if (text.length <= budget) return text;
  if (budget <= 3) return "...".slice(0, Math.max(0, budget));
  const slice = text.slice(0, budget - 3); // room for the ellipsis
  const cut = slice.replace(/\s+\S*$/, ""); // drop the partial trailing word
  return `${(cut || slice).trimEnd()}...`;
}

/**
 * Build the precise text for one channel. Assembly order is caption, CTA line,
 * hashtags, link, disclaimer; the disclaimer and link are reserved first so the
 * flexible parts (hashtags, then caption) absorb any overflow.
 */
export function renderChannelText(post: RenderablePost, channel: ChannelId): RenderedChannelText {
  const spec = CHANNELS[channel];
  const notes: string[] = [];
  const disclaimer = CAMPAIGN.paidForBy; // "Paid for by Matt Grant for Congress."
  // Instagram captions can't hold a clickable link, so we omit it from the text
  // (a dead URL is noise) and tell the poster to use link-in-bio instead.
  const link = channel === "instagram" ? "" : post.link?.trim() || "";

  // CTA line — only when we have one and the caption doesn't already say it.
  const caption = post.caption.trim();
  const ctaRaw = post.cta?.trim() || "";
  const captionSaysCta = ctaRaw
    ? caption.toLowerCase().includes(ctaRaw.toLowerCase())
    : CTA_HINTS.some((c) => caption.toLowerCase().includes(c));
  const cta = ctaRaw && !captionSaysCta ? ctaRaw : "";

  // Hashtags capped to the channel's hard maximum (Threads 1, IG 30, …).
  const cap = spec.maxHashtags > 0 ? spec.maxHashtags : post.hashtags.length;
  let tags = post.hashtags.map(hashTag);
  let droppedHashtags = Math.max(0, tags.length - cap);
  tags = tags.slice(0, cap);

  if (channel === "instagram" && post.link?.trim()) {
    notes.push(`Instagram links aren't clickable — the link is left out of the text; put ${post.link.trim()} in your bio.`);
  }

  // Assemble with the fixed parts (link + disclaimer) reserved, then fit.
  const fixedTail = [link, disclaimer].filter(Boolean).join("\n\n");
  const join = (parts: string[]) => parts.filter(Boolean).join("\n\n");

  const build = (cap0: string, tagList: string[]) =>
    join([join([cap0, cta].filter(Boolean)), tagList.join(" "), fixedTail]);

  let text = build(caption, tags);
  let fitted = false;

  // Over the limit: drop hashtags from the end first (cheapest to lose)…
  while (text.length > spec.maxChars && tags.length > 0) {
    tags = tags.slice(0, -1);
    droppedHashtags++;
    fitted = true;
    text = build(caption, tags);
  }
  // …then truncate the caption at a word boundary, keeping CTA + link + disclaimer
  // intact. Budget = limit − everything-but-caption − the "\n\n" join separator;
  // a final shrink loop absorbs any rounding so the result is always within limit.
  if (text.length > spec.maxChars) {
    const overhead = build("", tags).length + 2; // other blocks + the caption join separator
    let budget = Math.max(0, spec.maxChars - overhead);
    let trimmedCaption = truncateWords(caption, budget);
    text = build(trimmedCaption, tags);
    while (text.length > spec.maxChars && budget > 0) {
      budget = Math.max(0, budget - (text.length - spec.maxChars));
      trimmedCaption = truncateWords(caption, budget);
      text = build(trimmedCaption, tags);
    }
    fitted = true;
  }

  if (fitted) {
    notes.push(`Trimmed to fit ${spec.label}'s ${spec.maxChars}-character limit${droppedHashtags ? ` (${droppedHashtags} hashtag(s) dropped)` : ""}. The "Paid for by" line is always kept.`);
  }

  return { channel, text, chars: text.length, maxChars: spec.maxChars, fitted, droppedHashtags, notes };
}
