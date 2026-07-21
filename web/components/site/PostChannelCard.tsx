"use client";

import { useState } from "react";
import { CHANNEL_IDS, CHANNELS, renderChannelText, type ChannelId, type RenderablePost } from "@/lib/social/channels";
import { channelPostUrl } from "@/lib/social/sharePost";
import { SITE_URL } from "@/lib/site";

// Public, self-serve version of the dashboard's ReadyToPostCard: for one approved
// post it renders the exact, channel-fitted text to paste (caption → CTA → hashtags
// → link → the "Paid for by" disclaimer, trimmed to each platform's limit) with a
// per-channel copy button, char count, and notes. renderChannelText is pure and
// client-safe, so this is byte-identical to what the campaign's own tools produce.
// No server actions here — supporters just copy.
export function PostChannelCard({ post }: { post: RenderablePost }) {
  return (
    <div className="space-y-2">
      {CHANNEL_IDS.map((c) => (
        <ChannelRow key={c} post={post} channel={c} />
      ))}
    </div>
  );
}

function ChannelRow({ post, channel }: { post: RenderablePost; channel: ChannelId }) {
  const spec = CHANNELS[channel];
  const rendered = renderChannelText(post, channel);
  const [open, setOpen] = useState(false);
  const shortLabel = spec.label.replace(/\s*\(.*\)$/, "");
  const openTo = channelPostUrl(channel, { text: rendered.text, link: post.link ?? SITE_URL });

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
        <a
          href={openTo.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-sm border border-ink bg-ink px-2 py-0.5 text-[0.7rem] font-semibold text-paper hover:bg-field hover:border-field"
        >
          Open {shortLabel} ↗
        </a>
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
