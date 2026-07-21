"use client";

import { useState } from "react";
import { confirmPostedAction } from "@/app/dashboard/social/actions";
import { CHANNELS, renderChannelText, type ChannelId } from "@/lib/social/channels";
import type { ScheduledPost } from "@/lib/social/schedule";

// One staged post in the "Ready to post — needs a human" queue. Unlike the old
// single generic copy box, each MANUAL channel gets its own row with the exact,
// channel-fitted text to paste (caption + CTA + hashtags + link + the "Paid for
// by" disclaimer, trimmed to the platform limit), a per-channel copy button, the
// character count, and the mark-posted control. renderChannelText is pure and
// client-safe, so the string shown here is byte-identical to what auto-publish
// would send.
export function ReadyToPostCard({ post }: { post: ScheduledPost }) {
  const manual = post.channels.filter((c) => post.perChannel[c]?.status === "ready");
  return (
    <div className="card p-4">
      <p className="text-sm text-ink">{post.caption.length > 140 ? `${post.caption.slice(0, 140)}…` : post.caption}</p>
      <div className="mt-3 space-y-2">
        {manual.map((c) => (
          <ChannelRow key={c} post={post} channel={c} />
        ))}
      </div>
      {post.mediaUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <CopyValue value={post.mediaUrl} label="Copy image link" />
          <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="font-mono text-[0.65rem] text-field hover:underline">
            open image ↗
          </a>
          <span className="font-mono text-[0.6rem] text-slate">Attach this image when you post.</span>
        </div>
      )}
    </div>
  );
}

function ChannelRow({ post, channel }: { post: ScheduledPost; channel: ChannelId }) {
  const spec = CHANNELS[channel];
  const rendered = renderChannelText(
    { caption: post.caption, hashtags: post.hashtags, link: post.link, cta: post.cta },
    channel,
  );
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-sm border border-line bg-paper/30 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] text-paper" style={{ background: spec?.color ?? "#555" }}>
          {spec?.label ?? channel}
        </span>
        <span className="font-mono text-[0.6rem] tabular-nums text-slate">
          {rendered.chars}/{rendered.maxChars}
        </span>
        {rendered.fitted && (
          <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-gold-ink">fitted</span>
        )}
        <CopyValue value={rendered.text} label="Copy text" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-mono text-[0.6rem] text-field hover:underline"
        >
          {open ? "hide" : "show text"}
        </button>
        <form action={confirmPostedAction} className="ml-auto">
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="channel" value={channel} />
          <button className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] text-field hover:border-field">mark posted ✓</button>
        </form>
      </div>
      {open && (
        <>
          <textarea
            readOnly
            value={rendered.text}
            rows={5}
            aria-label={`${spec?.label ?? channel} post text`}
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
