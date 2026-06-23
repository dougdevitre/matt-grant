"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { schedulePost, type ActionState } from "@/app/dashboard/social/actions";
import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/social/channels";
import { scoreContent, type Severity } from "@/lib/social/optimize";

type LibraryPost = {
  id: string;
  caption: string;
  hashtags: string[];
  channels: ChannelId[];
  pillar: string;
  cta: string;
  graphic: string;
  day: number;
};

const CTAS = ["Donate", "Volunteer", "Vote", "Learn more", "Share"];
const sevColor: Record<Severity, string> = { error: "text-brick", warn: "text-[#9a6f1a]", tip: "text-slate" };

export function SocialComposer({ library }: { library: LibraryPost[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(schedulePost, { ok: false, message: "" });

  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [channels, setChannels] = useState<ChannelId[]>(["x", "facebook", "instagram"]);
  const [cta, setCta] = useState("Learn more");
  const [pillar, setPillar] = useState("");
  const [link, setLink] = useState("");
  const [attachGraphic, setAttachGraphic] = useState(true);
  const [disclaimerInCopy, setDisclaimerInCopy] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const tagList = useMemo(
    () => hashtags.split(/[\s,]+/).map((t) => t.trim().replace(/^#+/, "")).filter(Boolean).map((t) => `#${t}`),
    [hashtags],
  );

  // On-brand graphic carries the "Paid for by" line, so attaching one satisfies
  // the disclaimer requirement; otherwise it must be in the copy.
  const hasDisclaimer = attachGraphic || disclaimerInCopy;
  const graphicUrl = useMemo(() => {
    const headline = (caption.split("\n")[0] || "Matt Grant for Congress").slice(0, 80);
    const fmt = channels[0] ? CHANNELS[channels[0]].imageFormat : "ig_square";
    return `/api/graphics?${new URLSearchParams({ format: fmt, theme: "navy", headline, sub: "Matt Grant for Congress" }).toString()}`;
  }, [caption, channels]);
  const mediaUrl = attachGraphic ? graphicUrl : "";

  const scores = useMemo(
    () => channels.map((ch) => scoreContent({ channel: ch, caption, hashtags: tagList, hasMedia: attachGraphic, link: link || undefined, cta, hasDisclaimer })),
    [channels, caption, tagList, attachGraphic, link, cta, hasDisclaimer],
  );

  function loadFromLibrary(id: string) {
    const p = library.find((x) => x.id === id);
    if (!p) return;
    setCaption(p.caption);
    setHashtags(p.hashtags.join(" "));
    setChannels(p.channels.length ? p.channels : ["x", "facebook", "instagram"]);
    setCta(p.cta);
    setPillar(p.pillar);
  }

  const toggle = (ch: ChannelId) => setChannels((c) => (c.includes(ch) ? c.filter((x) => x !== ch) : [...c, ch]));
  const input = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Compose */}
      <div className="space-y-5">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-slate">Pull from the content calendar</p>
            <span className="font-mono text-[0.6rem] text-slate">{library.length} ready posts</span>
          </div>
          <select className={`mt-3 ${input}`} defaultValue="" onChange={(e) => loadFromLibrary(e.target.value)}>
            <option value="">Start from scratch…</option>
            {library.map((p) => (
              <option key={p.id} value={p.id}>
                D-{p.day} · {p.pillar} — {p.caption.slice(0, 60)}…
              </option>
            ))}
          </select>
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">Channels</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHANNEL_IDS.map((ch) => {
              const on = channels.includes(ch);
              return (
                <button
                  type="button"
                  key={ch}
                  onClick={() => toggle(ch)}
                  aria-pressed={on}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"}`}
                >
                  {CHANNELS[ch].label}
                  {!CHANNELS[ch].apiPublish && <span className={`ml-1.5 font-mono text-[0.55rem] ${on ? "text-paper/60" : "text-slate"}`}>manual</span>}
                </button>
              );
            })}
          </div>
          {channels.map((ch) => (
            <input key={ch} type="hidden" name="channels" value={ch} />
          ))}
        </div>

        <div className="card p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Caption</span>
            <textarea name="caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} className={input} placeholder="Write the post. First line is the hook — front-load it." />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink">Hashtags</span>
            <input name="hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={input} placeholder="#MattGrant #MO02 #ChildrenFirst" />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink">Call to action</span>
              <select name="cta" value={cta} onChange={(e) => setCta(e.target.value)} className={input}>
                {CTAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink">Pillar (optional)</span>
              <input name="pillar" value={pillar} onChange={(e) => setPillar(e.target.value)} className={input} placeholder="Children First" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink">Link (optional)</span>
            <input name="link" value={link} onChange={(e) => setLink(e.target.value)} className={input} placeholder="https://mattgrantforcongress.org/act" />
          </label>
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">Image</p>
          <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">Attach on-brand graphic (auto-includes the “Paid for by” line)</span>
            <input type="checkbox" checked={attachGraphic} onChange={() => setAttachGraphic((v) => !v)} />
          </label>
          {!attachGraphic && (
            <label className="mt-3 flex cursor-pointer items-center justify-between text-sm">
              <span className="font-semibold text-ink">My caption already includes the “Paid for by” disclaimer</span>
              <input type="checkbox" checked={disclaimerInCopy} onChange={() => setDisclaimerInCopy((v) => !v)} />
            </label>
          )}
          <input type="hidden" name="mediaUrl" value={mediaUrl} />
          {attachGraphic && (
            <div className="mt-3 overflow-hidden rounded-sm border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={graphicUrl} alt="Generated graphic preview" className="w-full" />
            </div>
          )}
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">When</p>
          <input type="datetime-local" name="scheduledAt" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`mt-3 ${input}`} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              name="mode"
              value="now"
              disabled={pending}
              onClick={(e) => {
                const where = channels.map((c) => CHANNELS[c].label).join(", ") || "the selected channels";
                if (!window.confirm(`Publish now to ${where}? This posts publicly right away.`)) e.preventDefault();
              }}
              className="btn-primary disabled:opacity-50"
            >
              {pending ? "Working…" : "Post now"}
            </button>
            <button type="submit" name="mode" value="schedule" disabled={pending} className="btn-ghost disabled:opacity-50">
              Schedule
            </button>
            <button type="submit" name="mode" value="draft" disabled={pending} className="btn-ghost disabled:opacity-50">
              Save draft
            </button>
          </div>
          {state.message && <p className={`mt-3 text-sm ${state.ok ? "text-field" : "text-brick"}`}>{state.message}</p>}
        </div>
      </div>

      {/* Live per-channel scoring */}
      <div className="space-y-4">
        <p className="eyebrow text-slate">Per-channel preview</p>
        {channels.length === 0 && <p className="text-sm text-slate">Pick a channel to see how the post fits.</p>}
        {scores.map((s) => {
          const spec = CHANNELS[s.channel];
          const over = s.overBy > 0;
          return (
            <div key={s.channel} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: spec.color }} />
                  {spec.label}
                </span>
                <span className={`font-mono text-xs ${s.score >= 80 ? "text-field" : s.score >= 60 ? "text-[#9a6f1a]" : "text-brick"}`}>{s.score}/100</span>
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[0.7rem]">
                <span className={over ? "text-brick" : "text-slate"}>
                  {s.chars}/{s.maxChars} chars{over ? ` · ${s.overBy} over` : ""}
                </span>
                <span className="text-slate">{s.hashtagCount} tags · best {spec.bestTimesCt[0]} CT</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div className={`h-full ${over ? "bg-brick" : "bg-field"}`} style={{ width: `${Math.min(100, (s.chars / s.maxChars) * 100)}%` }} />
              </div>
              {s.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {s.issues.map((i, n) => (
                    <li key={n} className={`text-xs ${sevColor[i.severity]}`}>
                      {i.severity === "error" ? "✕" : i.severity === "warn" ? "!" : "›"} {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </form>
  );
}
