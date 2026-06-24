"use client";

import { useState } from "react";
import { CopyButton } from "@/components/dashboard/CopyButton";

// Download / save-to-library controls for the candidate "where they differ"
// share card (rendered by /api/research/contrast-card). Mirrors the save flow
// in StudioForm: fetch the PNG, POST it to the asset library as a public asset.
export function ContrastCard({ slug, name }: { slug: string; name: string }) {
  const src = `/api/research/contrast-card?candidate=${encodeURIComponent(slug)}`;
  const file = `contrast-${slug}.png`;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function saveToLibrary() {
    setSaving(true);
    setSaved(null);
    try {
      const blob = await (await fetch(src)).blob();
      const fd = new FormData();
      fd.append("file", new File([blob], file, { type: "image/png" }));
      fd.append("visibility", "public");
      const r = await fetch("/api/assets/upload", { method: "POST", body: fd });
      const d = await r.json();
      setSaved(r.ok ? d.url || "Saved to library" : d.error || "Save failed");
    } catch (e) {
      setSaved(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-sm border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold text-ink">Contrast card</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
          {open ? "Hide preview" : "Preview"}
        </button>
        <a href={src} download={file} className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
          Download PNG ↓
        </a>
        <button type="button" onClick={saveToLibrary} disabled={saving} className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink disabled:opacity-50">
          {saving ? "Saving…" : "Save to library"}
        </button>
        <CopyButton text={src} label="Copy URL" />
      </div>
      {saved && <p className="mt-2 break-all font-mono text-xs text-field">{saved}</p>}
      {open && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Contrast share card for ${name}`} loading="lazy" className="mt-3 w-full max-w-sm rounded-sm border border-line" />
      )}
    </div>
  );
}
