"use client";

import { useEffect, useMemo, useState } from "react";
import { trimHeadline } from "@/lib/social/headline";
import { graphicSrc } from "@/lib/social/graphicUrl";

// Public branded-graphic maker. Wraps the already-public GET /api/graphics endpoint
// (rate-limited, disclaimer baked onto the image) with a format/theme/photo picker,
// a live preview, and a download. The headline is DERIVED from the selected approved
// post (not a free-text box), so a supporter can't put arbitrary copy on the campaign
// brand — this stays approved-content-only, like the rest of /social.
const FORMATS = [
  { id: "ig_square", label: "Instagram / Facebook square", dims: "1080×1080" },
  { id: "ig_story", label: "Story / Reel / TikTok", dims: "1080×1920" },
  { id: "x_header", label: "X post image", dims: "1500×500" },
  { id: "fb_cover", label: "Facebook cover", dims: "1640×624" },
  { id: "web_banner", label: "Web banner", dims: "1200×400" },
] as const;

const THEMES = [
  { id: "brick", label: "Red", swatch: "#B5343B" },
  { id: "navy", label: "Navy", swatch: "#0F2540" },
  { id: "paper", label: "White", swatch: "#FBFAF6" },
] as const;

export type GraphicParams = { format: string; theme: string; photo: boolean };

export function GraphicPicker({ headlineSource, onChange }: { headlineSource: string; onChange?: (p: GraphicParams) => void }) {
  const [format, setFormat] = useState<string>("ig_square");
  const [theme, setTheme] = useState<string>("brick");
  const [photo, setPhoto] = useState(true);

  const headline = useMemo(() => trimHeadline(headlineSource, 90), [headlineSource]);
  const src = useMemo(() => graphicSrc({ format, theme, photo, headline: headlineSource }), [format, theme, photo, headlineSource]);

  // Report the chosen params up: the hero share uses this exact image, and the
  // per-channel buttons reuse the theme/photo at each channel's ideal size.
  useEffect(() => {
    onChange?.({ format, theme, photo });
  }, [format, theme, photo, onChange]);

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="eyebrow text-slate">Size</legend>
          <div className="grid gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                aria-pressed={format === f.id}
                className={`rounded-sm border px-3 py-2 text-left text-xs transition-colors ${
                  format === f.id ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"
                }`}
              >
                <span className="block font-semibold">{f.label}</span>
                <span className={`font-mono text-[0.6rem] ${format === f.id ? "text-paper/70" : "text-slate"}`}>{f.dims}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="eyebrow text-slate">Color</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={theme === t.id}
                className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-sm ${theme === t.id ? "border-ink" : "border-line hover:border-ink"}`}
              >
                <span aria-hidden className="h-4 w-4 rounded-full border border-line" style={{ background: t.swatch }} />
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between text-sm">
          <span className="font-semibold text-ink">Include Matt&apos;s photo</span>
          <input type="checkbox" checked={photo} onChange={() => setPhoto((v) => !v)} />
        </label>

        <a href={src} download={`matt-grant-${format}.png`} className="btn-primary w-full text-center">
          Download image
        </a>
      </div>

      <div className="card flex items-center justify-center bg-paper/60 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Campaign graphic: ${headline}`}
          className="max-h-[52vh] w-auto max-w-full rounded-sm border border-line shadow-card"
        />
      </div>
    </div>
  );
}
