// Bridge the approved 50-post library (lib/socialPosts.ts) onto the pure
// per-channel renderer (lib/social/channels.ts) for the PUBLIC /social toolkit.
// A supporter picks an approved post; we render copy-ready text for every channel
// with the "Paid for by" disclaimer baked in. No free-text authoring lives here —
// only vetted library posts flow through, so nothing can attach the campaign brand
// to an invented claim. Pure + isomorphic (usable in a client component).

import { SITE_URL } from "@/lib/site";
import type { SocialPost, CTA } from "@/lib/socialPosts";
import type { RenderablePost } from "@/lib/social/channels";

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
