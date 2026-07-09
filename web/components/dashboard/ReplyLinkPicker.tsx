"use client";

import { REPLY_LINKS, REPLY_GROUPS, replyInsert, suggestReplyLinks, type ReplyLink } from "@/lib/sms/reply-links";

// Quick-insert campaign-site links into a 1:1 reply. Shows the links most relevant to what the
// person just texted first ("Suggested"), then everything grouped. Clicking a chip drops an
// on-message sentence + the trackable link into the reply box — the staffer still edits + sends.
export function ReplyLinkPicker({ lastInbound, onInsert }: { lastInbound?: string; onInsert: (text: string) => void }) {
  const suggested = suggestReplyLinks(lastInbound);

  const chip = (l: ReplyLink, key: string) => (
    <button
      type="button"
      key={key}
      onClick={() => onInsert(replyInsert(l))}
      title={replyInsert(l)}
      className="rounded-sm border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-ink"
    >
      + {l.label}
    </button>
  );

  return (
    <details className="mt-3 rounded-sm border border-line bg-paper/50 px-3 py-2">
      <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-eyebrow text-field">
        🔗 Insert a link{suggested.length > 0 ? ` · ${suggested.length} suggested` : ""}
      </summary>

      {suggested.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">Suggested for their message</p>
          <div className="flex flex-wrap gap-1.5">{suggested.map((l, i) => chip(l, `sug-${l.campaign}-${i}`))}</div>
        </div>
      )}

      {REPLY_GROUPS.map((g) => {
        const links = REPLY_LINKS.filter((l) => l.group === g);
        if (!links.length) return null;
        return (
          <div key={g} className="mt-3">
            <p className="mb-1.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{g}</p>
            <div className="flex flex-wrap gap-1.5">{links.map((l) => chip(l, l.campaign))}</div>
          </div>
        );
      })}
    </details>
  );
}
