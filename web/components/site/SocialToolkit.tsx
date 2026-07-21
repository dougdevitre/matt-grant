"use client";

import { useEffect, useMemo, useState } from "react";
import { SHAREABLE_POSTS, PILLARS, type Pillar, type CTA, type SocialPost } from "@/lib/socialPosts";
import { renderChannelText } from "@/lib/social/channels";
import { toRenderablePost } from "@/lib/social/sharePost";
import { graphicSrc } from "@/lib/social/graphicUrl";
import { shareImageFile, toImageFile, canShareFiles, type ShareOutcome } from "@/lib/social/nativeShare";
import { CAMPAIGN } from "@/lib/site";
import { PostChannelCard } from "./PostChannelCard";
import { GraphicPicker } from "./GraphicPicker";

const CTAS: CTA[] = ["Vote", "Volunteer", "Donate", "Learn more", "Share"];

// Distinct audiences, derived from the data (persona is a free-form string).
const PERSONAS = Array.from(new Set(SHAREABLE_POSTS.map((p) => p.persona))).sort();

type PillarFilter = Pillar | "all";
type PersonaFilter = string;
type CtaFilter = CTA | "all";

export function SocialToolkit() {
  const [pillar, setPillar] = useState<PillarFilter>("all");
  const [persona, setPersona] = useState<PersonaFilter>("all");
  const [cta, setCta] = useState<CtaFilter>("all");
  const [selectedId, setSelectedId] = useState<string>(SHAREABLE_POSTS[0].id);

  const filtered = useMemo(
    () =>
      SHAREABLE_POSTS.filter(
        (p) =>
          (pillar === "all" || p.pillar === pillar) &&
          (persona === "all" || p.persona === persona) &&
          (cta === "all" || p.cta === cta),
      ),
    [pillar, persona, cta],
  );

  // Effective selection: keep the chosen post if it survives the filter, else the
  // first match. Derived (no effect) so it can never get out of sync.
  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  const pill = "rounded-full border px-3 py-1 text-sm transition-colors";
  const on = "border-ink bg-ink text-paper";
  const off = "border-line bg-white text-ink hover:border-ink";

  return (
    <div className="mt-8">
      {/* Filters */}
      <div className="space-y-4 rounded-md border border-line bg-paper/40 p-4">
        <FilterRow label="Issue">
          <button type="button" onClick={() => setPillar("all")} aria-pressed={pillar === "all"} className={`${pill} ${pillar === "all" ? on : off}`}>All issues</button>
          {PILLARS.map((p) => (
            <button key={p} type="button" onClick={() => setPillar(p)} aria-pressed={pillar === p} className={`${pill} ${pillar === p ? on : off}`}>{p}</button>
          ))}
        </FilterRow>
        <FilterRow label="Goal">
          <button type="button" onClick={() => setCta("all")} aria-pressed={cta === "all"} className={`${pill} ${cta === "all" ? on : off}`}>Any goal</button>
          {CTAS.map((c) => (
            <button key={c} type="button" onClick={() => setCta(c)} aria-pressed={cta === c} className={`${pill} ${cta === c ? on : off}`}>{c}</button>
          ))}
        </FilterRow>
        <FilterRow label="Audience">
          <label className="sr-only" htmlFor="persona-select">Filter by audience</label>
          <select
            id="persona-select"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="rounded-sm border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-field"
          >
            <option value="all">Any audience</option>
            {PERSONAS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </FilterRow>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        {/* The comprehensive list */}
        <div>
          <p className="mb-3 font-mono text-xs text-slate" role="status">{filtered.length} post{filtered.length === 1 ? "" : "s"}</p>
          <ul className="space-y-2">
            {filtered.map((p) => {
              const isSel = selected?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    aria-pressed={isSel}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${isSel ? "border-ink bg-paper" : "border-line bg-white hover:border-ink"}`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow text-paper">{p.pillar}</span>
                      <span className="font-mono text-[0.6rem] text-slate">{p.cta}</span>
                    </span>
                    <span className="mt-1.5 block text-sm text-ink">{p.caption.length > 120 ? `${p.caption.slice(0, 120)}…` : p.caption}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="rounded-md border border-line bg-white p-4 text-sm text-slate">No posts match those filters. Try “All issues” or a different audience.</li>
            )}
          </ul>
        </div>

        {/* Detail: copy-ready text + graphic + share, for the selected post */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <Detail post={selected} />
          ) : (
            <div className="card p-6 text-sm text-slate">Pick a post from the list to get copy-ready text and a graphic.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 font-mono text-[0.7rem] uppercase tracking-eyebrow text-slate">{label}</span>
      {children}
    </div>
  );
}

function Detail({ post }: { post: SocialPost }) {
  const renderable = toRenderablePost(post);
  // Full, channel-agnostic caption for the one-tap share (caption + hashtags + link +
  // the "Paid for by" disclaimer). Facebook's generous limit keeps everything intact.
  const shareText = renderChannelText(renderable, "facebook").text;
  const filename = `matt-grant-${post.id}.png`;

  // The graphic currently shown in the picker — the exact image every share uses.
  const [imageSrc, setImageSrc] = useState(() => graphicSrc({ format: "ig_square", theme: "brick", photo: true, headline: post.caption }));
  // Pre-fetch it into a File so navigator.share() fires inside the click's activation.
  const [imageFile, setImageFile] = useState<File | null>(null);
  useEffect(() => {
    let live = true;
    setImageFile(null);
    toImageFile(imageSrc, filename).then((f) => {
      if (live) setImageFile(f);
    });
    return () => {
      live = false;
    };
  }, [imageSrc, filename]);

  const [status, setStatus] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  async function onShare() {
    setSharing(true);
    setStatus("Preparing…");
    const outcome: ShareOutcome = await shareImageFile({ file: imageFile, imageUrl: imageSrc, filename, text: shareText, title: CAMPAIGN.committee, channel: "sheet" });
    setSharing(false);
    setStatus(
      outcome === "shared"
        ? "Opened your share sheet — pick an app to post."
        : outcome === "downloaded"
          ? "Image saved and caption copied — open your app, paste, and attach the image."
          : outcome === "cancelled"
            ? ""
            : "Couldn't prepare the image — try Download on the graphic below.",
    );
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-ink px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-paper">{post.pillar}</span>
        <span className="font-mono text-[0.65rem] text-slate">For: {post.persona}</span>
      </div>
      <p className="mt-3 text-ink">{post.caption}</p>
      <p className="mt-2 font-mono text-xs text-field">{post.hashtags.join(" ")}</p>

      <h3 className="mt-6 text-sm font-semibold text-ink">Your graphic</h3>
      <p className="mb-3 text-xs text-slate">Branded image with the disclaimer built in — pick a size and color; this is what gets shared.</p>
      <GraphicPicker headlineSource={post.caption} onSrcChange={setImageSrc} />

      {/* Hero one-tap share */}
      <div className="mt-5 rounded-md border border-line bg-paper/50 p-4">
        <button type="button" onClick={onShare} disabled={sharing} className="btn-primary w-full text-center disabled:opacity-60">
          {sharing ? "Preparing…" : "Share this post + image"}
        </button>
        <p className="mt-2 text-xs text-slate">
          On a phone this opens your share sheet with the image and caption loaded — tap any app to post. On a computer it saves the image and copies the caption.
        </p>
        <p role="status" aria-live="polite" className="mt-1 min-h-[1rem] text-xs font-semibold text-field">{status}</p>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-ink">Or post to one channel</h3>
      <p className="mb-2 text-xs text-slate">
        <strong className="font-semibold text-ink">Post to</strong> opens that channel and copies the caption + saves the image (paste, attach, post).
        Or <strong className="font-semibold text-ink">Copy text</strong> for just the words. Every version ends with the required disclaimer.
      </p>
      <div className="mt-2">
        <PostChannelCard post={renderable} imageUrl={imageSrc} filename={filename} />
      </div>
    </div>
  );
}
