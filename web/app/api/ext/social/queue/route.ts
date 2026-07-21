import { extRoute } from "@/lib/http/ext-route";
import { listPosts } from "@/lib/social/schedule";
import { renderChannelText, CHANNELS } from "@/lib/social/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ext/social/queue — the "ready to post, needs a human" queue for the
// browser extension. Returns each staged post's MANUAL channels with the exact,
// channel-fitted text to paste (caption + CTA + hashtags + link + the "Paid for
// by" disclaimer, trimmed to the platform limit) — the same renderChannelText the
// dashboard and auto-publisher use, so the extension pastes byte-identical copy.
// Read-only + manageSocial-gated + CORS, via the shared extRoute factory.
export const { GET, OPTIONS } = extRoute({
  capability: "manageSocial",
  source: "social manual queue",
  load: async () => {
    const posts = await listPosts();
    const awaiting = posts.filter((p) => p.status === "awaiting" || p.status === "partial");
    return awaiting.map((p) => ({
      id: p.id,
      caption: p.caption,
      scheduledAt: p.scheduledAt ?? p.createdAt,
      mediaUrl: p.mediaUrl ?? null,
      channels: p.channels
        .filter((c) => p.perChannel[c]?.status === "ready")
        .map((c) => {
          const r = renderChannelText({ caption: p.caption, hashtags: p.hashtags, link: p.link, cta: p.cta }, c);
          return {
            channel: c,
            label: CHANNELS[c]?.label ?? c,
            text: r.text,
            chars: r.chars,
            maxChars: r.maxChars,
            fitted: r.fitted,
            notes: r.notes,
          };
        }),
    }));
  },
});
