import { describe, it, expect } from "vitest";
import { SOCIAL_POSTS } from "@/lib/socialPosts";
import { CHANNEL_IDS, renderChannelText } from "@/lib/social/channels";
import { CTA_PATH, ctaUrl, toRenderablePost } from "@/lib/social/sharePost";
import { CAMPAIGN, SITE_URL } from "@/lib/site";

describe("sharePost — approved-library → per-channel renderer", () => {
  it("maps every CTA in the library to a public absolute URL", () => {
    const ctas = new Set(SOCIAL_POSTS.map((p) => p.cta));
    for (const cta of ctas) {
      expect(CTA_PATH[cta]).toMatch(/^\//);
      expect(ctaUrl(cta)).toBe(`${SITE_URL}${CTA_PATH[cta]}`);
    }
  });

  it("renders every library post on every channel WITH the FEC disclaimer, within the char limit", () => {
    for (const post of SOCIAL_POSTS) {
      const renderable = toRenderablePost(post);
      for (const channel of CHANNEL_IDS) {
        const r = renderChannelText(renderable, channel);
        expect(r.text, `${post.id}/${channel} must carry the disclaimer`).toContain(CAMPAIGN.paidForBy);
        expect(r.chars, `${post.id}/${channel} must fit ${r.maxChars}`).toBeLessThanOrEqual(r.maxChars);
      }
    }
  });

  it("omits the (unclickable) link from Instagram text but keeps it elsewhere", () => {
    const post = SOCIAL_POSTS[0];
    const renderable = toRenderablePost(post);
    const ig = renderChannelText(renderable, "instagram");
    const x = renderChannelText(renderable, "x");
    expect(ig.text).not.toContain(renderable.link!);
    // X may trim, but the link is short and reserved before hashtags, so it survives here.
    expect(x.text).toContain(renderable.link!);
  });
});
