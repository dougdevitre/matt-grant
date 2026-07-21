"use client";

import { useState } from "react";
import { CHANNEL_IDS, CHANNELS, renderChannelText, type ChannelId, type RenderablePost } from "@/lib/social/channels";
import { channelPostUrl } from "@/lib/social/sharePost";
import { graphicSrc } from "@/lib/social/graphicUrl";
import { postToChannel } from "@/lib/social/nativeShare";
import { SITE_URL } from "@/lib/site";

// Public, self-serve version of the dashboard's ReadyToPostCard: for one approved
// post it renders the exact, channel-fitted text to paste (caption → CTA → hashtags
// → link → the "Paid for by" disclaimer, trimmed to each platform's limit) with a
// per-channel copy button, char count, and notes. renderChannelText is pure and
// client-safe, so this is byte-identical to what the campaign's own tools produce.
// "Post to [platform]" opens the channel and copies the caption + saves the image,
// auto-sized to that platform via CHANNELS[channel].imageFormat.
export function PostChannelCard({
  post,
  theme,
  photo,
  headline,
  idBase,
}: {
  post: RenderablePost;
  theme?: string;
  photo?: boolean;
  headline?: string;
  idBase?: string;
}) {
  return (
    <div className="space-y-2">
      {CHANNEL_IDS.map((c) => (
        <ChannelRow key={c} post={post} channel={c} theme={theme} photo={photo} headline={headline} idBase={idBase} />
      ))}
    </div>
  );
}

function ChannelRow({
  post,
  channel,
  theme,
  photo,
  headline,
  idBase,
}: {
  post: RenderablePost;
  channel: ChannelId;
  theme?: string;
  photo?: boolean;
  headline?: string;
  idBase?: string;
}) {
  const spec = CHANNELS[channel];
  const rendered = renderChannelText(post, channel);
  const [open, setOpen] = useState(false);
  const shortLabel = spec.label.replace(/\s*\(.*\)$/, "");
  const openTo = channelPostUrl(channel, { text: rendered.text, link: post.link ?? SITE_URL });
  // The image, sized for THIS channel (X→landscape, IG→square, TikTok/Story→9:16).
  const imageUrl = graphicSrc({ format: spec.imageFormat, theme: theme ?? "brick", photo: photo ?? true, headline: headline ?? "" });
  const filename = `matt-grant-${idBase ?? "post"}-${channel}.png`;

  return (
    <div className="rounded-sm border border-line bg-paper/40 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] font-semibold text-ink">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: spec.color }} />
          {spec.label}
        </span>
        <span className="font-mono text-[0.65rem] tabular-nums text-slate">
          {rendered.chars}/{rendered.maxChars}
        </span>
        {rendered.fitted && (
          <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-paper">trimmed</span>
        )}
        <CopyValue value={rendered.text} label="Copy text" />
        <button
          type="button"
          onClick={() =>
            postToChannel({
              openUrl: openTo.href,
              imageUrl,
              filename,
              text: rendered.text,
              channel,
            })
          }
          className="rounded-sm border border-ink bg-ink px-2 py-0.5 text-[0.7rem] font-semibold text-paper hover:bg-field hover:border-field"
        >
          Post to {shortLabel} ↗
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono text-[0.65rem] text-field hover:underline"
        >
          {open ? "hide" : "show text"}
        </button>
      </div>
      {open && (
        <>
          <textarea
            readOnly
            value={rendered.text}
            rows={6}
            aria-label={`${spec.label} post text`}
            className="mt-2 w-full rounded-sm border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
          />
          {rendered.notes.map((n) => (
            <p key={n} className="mt-1 text-[0.7rem] text-slate">{n}</p>
          ))}
        </>
      )}
    </div>
  );
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked — the text is selectable via "show text" */
        }
      }}
      aria-live="polite"
      className="rounded-sm border border-line bg-white px-2 py-0.5 text-[0.7rem] font-semibold text-ink hover:border-ink"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
