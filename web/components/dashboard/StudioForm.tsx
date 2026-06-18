"use client";

import { useMemo, useState } from "react";

const FORMATS = [
  { id: "ig_square", label: "IG / FB square", dims: "1080×1080" },
  { id: "ig_story", label: "IG / FB story", dims: "1080×1920" },
  { id: "x_header", label: "X header", dims: "1500×500" },
  { id: "fb_cover", label: "Facebook cover", dims: "1640×624" },
  { id: "yard_sign", label: "Yard sign", dims: "24×18" },
  { id: "web_banner", label: "Web banner", dims: "1200×400" },
];

const THEMES = [
  { id: "navy", label: "Navy", swatch: "#0F2540" },
  { id: "gold", label: "Gold", swatch: "#E0A53B" },
  { id: "brick", label: "Brick", swatch: "#B5343B" },
];

const BRAND_KIT = [
  { file: "og-card.png", label: "Social share card (1200×630)" },
  { file: "avatar-circle.png", label: "Round profile photo (800)" },
  { file: "headshot-print-300dpi.jpg", label: "Print headshot — mailers (300 DPI)" },
  { file: "portrait-1200.png", label: "Portrait (1200)" },
  { file: "portrait-800.png", label: "Portrait (800)" },
  { file: "icon-512.png", label: "App icon (512)" },
  { file: "icon-192.png", label: "Favicon (192)" },
];

export function StudioForm() {
  const [format, setFormat] = useState("ig_square");
  const [theme, setTheme] = useState("navy");
  const [headline, setHeadline] = useState("Put Missouri's children first.");
  const [sub, setSub] = useState("Matt Grant for Congress");
  const [photo, setPhoto] = useState(true);

  const query = useMemo(() => {
    const p = new URLSearchParams({ format, theme, headline, sub, photo: photo ? "1" : "0" });
    return p.toString();
  }, [format, theme, headline, sub, photo]);

  const src = `/api/graphics?${query}`;
  const input = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  async function saveToS3() {
    setSaving(true);
    setSaved(null);
    try {
      const blob = await (await fetch(src)).blob();
      const fd = new FormData();
      fd.append("file", new File([blob], `matt-grant-${format}.png`, { type: "image/png" }));
      fd.append("visibility", "public");
      const r = await fetch("/api/assets/upload", { method: "POST", body: fd });
      const d = await r.json();
      setSaved(r.ok ? d.url || "Saved to S3" : d.error || "Save failed");
    } catch (e) {
      setSaved(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls */}
      <div className="space-y-5">
        <div className="card p-5">
          <p className="eyebrow text-slate">Format</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={`rounded-sm border px-3 py-2 text-left text-xs transition-colors ${
                  format === f.id ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"
                }`}
              >
                <span className="block font-semibold">{f.label}</span>
                <span className={`font-mono text-[0.6rem] ${format === f.id ? "text-paper/70" : "text-slate"}`}>{f.dims}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">Copy</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink">Headline</span>
            <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={2} maxLength={80} className={input} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink">Subhead</span>
            <input value={sub} onChange={(e) => setSub(e.target.value)} maxLength={90} className={input} />
          </label>
        </div>

        <div className="card p-5">
          <p className="eyebrow text-slate">Theme</p>
          <div className="mt-3 flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
                  theme === t.id ? "border-ink" : "border-line"
                }`}
              >
                <span className="h-4 w-4 rounded-full" style={{ background: t.swatch }} />
                {t.label}
              </button>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between text-sm">
            <span className="font-semibold text-ink">Include photo</span>
            <input type="checkbox" checked={photo} onChange={() => setPhoto((v) => !v)} />
          </label>
        </div>

        <a href={src} download={`matt-grant-${format}.png`} className="btn-primary w-full">
          Download PNG
        </a>
        <button onClick={saveToS3} disabled={saving} className="btn-ghost w-full disabled:opacity-50">
          {saving ? "Saving…" : "Save to S3 (CloudFront)"}
        </button>
        {saved && <p className="break-all font-mono text-xs text-field">{saved}</p>}
      </div>

      {/* Preview + brand kit */}
      <div className="space-y-6">
        <div className="card flex items-center justify-center bg-paper/60 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Campaign graphic preview"
            className="max-h-[60vh] w-auto max-w-full rounded-sm border border-line shadow-card"
          />
        </div>

        <div className="card p-6">
          <p className="eyebrow text-slate">Brand kit — ready-made downloads</p>
          <p className="mt-1 text-xs text-slate">Generated from Matt's headshot. Re-run <span className="font-mono">npm run brand</span> after replacing the source photo.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {BRAND_KIT.map((b) => (
              <a
                key={b.file}
                href={`/brand/${b.file}`}
                download
                className="flex items-center justify-between rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-ink"
              >
                <span>{b.label}</span>
                <span className="font-mono text-xs text-field">↓</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
