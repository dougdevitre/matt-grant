// Bridge the approved 50-post library (lib/socialPosts.ts) onto the pure
// per-channel renderer (lib/social/channels.ts) for the PUBLIC /social toolkit.
// A supporter picks an approved post; we render copy-ready text for every channel
// with the "Paid for by" disclaimer baked in. No free-text authoring lives here —
// only vetted library posts flow through, so nothing can attach the campaign brand
// to an invented claim. Pure + isomorphic (usable in a client component).

import { SITE_URL } from "@/lib/site";
import type { SocialPost, CTA } from "@/lib/socialPosts";
import type { RenderablePost, ChannelId } from "@/lib/social/channels";

// Where each call-to-action points. Absolute URLs, because a shared post needs a
// clickable link off-platform. Every target is a confirmed public route.
export const CTA_PATH: Record<CTA, string> = {
  Vote: "/vote",
  Donate: "/donate",
  Volunteer: "/act",
  "Learn more": "/issues",
  Share: "/",
};

export function ctaUrl(cta: CTA): string {
  return `${SITE_URL}${CTA_PATH[cta]}`;
}

// Map a library post onto the renderer's input. `cta` is passed through so the
// renderer's own logic decides whether to add a CTA line (it only does when the
// caption doesn't already say it) — identical to how the staff command center
// renders these same posts, so /social output matches the dashboard byte-for-byte.
export function toRenderablePost(post: SocialPost): RenderablePost {
  return {
    caption: post.caption,
    hashtags: post.hashtags,
    link: ctaUrl(post.cta),
    cta: post.cta,
  };
}

// A deep link that opens the given channel's posting surface so a supporter can
// finish posting after copying the text. Three kinds, because the platforms differ:
//  - "compose": web compose that PREFILLS the text (X, Threads).
//  - "share":   web share of the campaign LINK (Facebook, LinkedIn) — text is copied.
//  - "upload":  the platform's upload/app surface where web prefill isn't possible
//               (Instagram, TikTok, YouTube) — paste the copied text + attach the image.
export type ChannelPostLink = { href: string; kind: "compose" | "share" | "upload" };

export function channelPostUrl(channel: ChannelId, o: { text: string; link: string }): ChannelPostLink {
  const text = encodeURIComponent(o.text);
  const url = encodeURIComponent(o.link || SITE_URL);
  switch (channel) {
    case "x":
      return { href: `https://twitter.com/intent/tweet?text=${text}`, kind: "compose" };
    case "threads":
      return { href: `https://www.threads.net/intent/post?text=${text}`, kind: "compose" };
    case "facebook":
      return { href: `https://www.facebook.com/sharer/sharer.php?u=${url}`, kind: "share" };
    case "linkedin":
      return { href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`, kind: "share" };
    case "instagram":
      return { href: "https://www.instagram.com/", kind: "upload" };
    case "tiktok":
      return { href: "https://www.tiktok.com/upload", kind: "upload" };
    case "youtube":
      return { href: "https://www.youtube.com/upload", kind: "upload" };
  }
}
