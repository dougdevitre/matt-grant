"use client";

import { useMemo, useState } from "react";
import { SOCIAL_POSTS, PILLARS, type Pillar, type SocialPost } from "@/lib/socialPosts";
import { ASSETS_CDN, SITE_URL, BRAND_DOWNLOADS, PRINT_DOWNLOADS, CAMPAIGN } from "@/lib/site";
import manifest from "@/lib/assets.manifest.json";

type Asset = { key: string; url: string; label: string; bytes: number };
const FLYERS = (manifest.groups.marketing as Asset[]).filter((a) => a.key.includes("/flyers/"));
const VIDEOS = manifest.groups.video as Asset[];

const pillarColor: Record<Pillar, string> = {
  "Children First": "bg-brick/12 text-brick",
  "Term Limits": "bg-field/15 text-field",
  "Smaller Government": "bg-ink/10 text-ink",
  "Lower Taxes": "bg-gold/20 text-[#1d4ed8]",
  "Bio & Values": "bg-field/12 text-field",
  Contrast: "bg-brick/12 text-brick",
  GOTV: "bg-brick/15 text-brick",
  Coalition: "bg-gold/20 text-[#1d4ed8]",
  "Faith & Community": "bg-field/12 text-field",
};

function shareText(p: SocialPost) {
  return `${p.caption}\n\n${p.hashtags.join(" ")}\n\n${CAMPAIGN.paidForBy}`;
}

function PostCard({ p }: { p: SocialPost }) {
  const [copied, setCopied] = useState(false);
  const text = shareText(p);
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${p.caption} ${p.hashtags.join(" ")}`)}&url=${encodeURIComponent(SITE_URL)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}&quote=${encodeURIComponent(p.caption)}`;
  const graphicUrl = `${ASSETS_CDN}/public/social/feed/${p.id}.png`;
  const storyUrl = `${ASSETS_CDN}/public/social/stories/${p.id}.png`;

  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-bold text-brick">{p.day} {p.day === 1 ? "day" : "days"} to go</span>
        <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${pillarColor[p.pillar]}`}>{p.pillar}</span>
      </div>
      <p className="mt-3 flex-1 text-sm text-ink">{p.caption}</p>
      <p className="mt-3 font-mono text-xs text-field">{p.hashtags.join(" ")}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-sm border border-line px-2 py-0.5 text-[0.6rem] text-slate">{p.persona}</span>
        <span className="rounded-sm border border-line px-2 py-0.5 text-[0.6rem] text-slate">{p.coalition}</span>
      </div>
      <p className="mt-2 font-mono text-[0.65rem] text-slate">▦ {p.graphic}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={copy} className="btn-ghost px-2.5 py-1 text-xs">{copied ? "Copied ✓" : "Copy caption"}</button>
        <a href={xUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2.5 py-1 text-xs">Share to X</a>
        <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2.5 py-1 text-xs">Share to FB</a>
        <a href={graphicUrl} target="_blank" rel="noopener noreferrer" download className="btn-ghost px-2.5 py-1 text-xs">Square ↓</a>
        <a href={storyUrl} target="_blank" rel="noopener noreferrer" download className="btn-ghost px-2.5 py-1 text-xs">Story ↓</a>
      </div>
    </div>
  );
}

export function MediaLibrary() {
  const [pillar, setPillar] = useState<Pillar | "All">("All");
  const posts = useMemo(
    () => (pillar === "All" ? SOCIAL_POSTS : SOCIAL_POSTS.filter((p) => p.pillar === pillar)),
    [pillar],
  );

  return (
    <>
      {/* Brand downloads */}
      <section className="card mb-8 p-6">
        <p className="eyebrow text-slate">Brand assets — download</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BRAND_DOWNLOADS.map((b) => (
            <a
              key={b.file}
              href={`${ASSETS_CDN}/public/${b.file}`}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center justify-between rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-ink"
            >
              <span>{b.label}</span>
              <span className="font-mono text-xs text-field">↓</span>
            </a>
          ))}
        </div>
      </section>

      {/* Print kit */}
      <section className="card mb-8 p-6">
        <p className="eyebrow text-slate">Print kit — print-ready PDFs</p>
        <p className="mt-1 text-xs text-slate">RGB with 0.125&quot; bleed. Online printers (VistaPrint, UPrinting) accept these as-is.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRINT_DOWNLOADS.map((b) => (
            <a
              key={b.file}
              href={`${ASSETS_CDN}/public/${b.file}`}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center justify-between rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-ink"
            >
              <span>{b.label}</span>
              <span className="font-mono text-xs text-field">PDF ↓</span>
            </a>
          ))}
        </div>
      </section>

      {/* Print at Walgreens */}
      <a
        href="/print"
        className="card mb-8 flex flex-col items-start justify-between gap-3 p-6 transition-colors hover:border-ink sm:flex-row sm:items-center"
      >
        <div>
          <p className="eyebrow text-brick">New — print at your Walgreens</p>
          <p className="mt-1 text-sm text-slate">Pick a design and a size, pick it up the same day at a store near you.</p>
        </div>
        <span className="btn-ink whitespace-nowrap">Open the print studio →</span>
      </a>

      {/* Video */}
      <section className="card mb-8 p-6">
        <p className="eyebrow text-slate">Video</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {VIDEOS.map((v) => (
            <figure key={v.key} className="overflow-hidden rounded-sm border border-line">
              <video src={v.url} className="aspect-video w-full bg-ink object-cover" muted loop playsInline controls preload="metadata" />
              <figcaption className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-ink">{v.label}</span>
                <a href={v.url} target="_blank" rel="noopener noreferrer" download className="font-mono text-field">MP4 ↓</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Flyers */}
      <section className="card mb-8 p-6">
        <p className="eyebrow text-slate">Flyers — {FLYERS.length} designs</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLYERS.map((f) => (
            <a
              key={f.key}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center justify-between rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-ink"
            >
              <span>{f.label}</span>
              <span className="font-mono text-xs text-field">↓</span>
            </a>
          ))}
        </div>
      </section>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["All", ...PILLARS] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPillar(p)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              pillar === p ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
    </>
  );
}
