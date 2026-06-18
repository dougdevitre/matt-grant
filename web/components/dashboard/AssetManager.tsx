"use client";

import { useCallback, useEffect, useState } from "react";

type Asset = { key: string; size: number; lastModified: string; visibility: "public" | "private"; url: string };

const isImage = (key: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(key);
const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function AssetManager() {
  const [items, setItems] = useState<Asset[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/assets/list")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(!!d.configured);
        setItems(d.items ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(load, [load]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!(form.get("file") as File)?.size) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "upload failed");
      setMsg(d.url ? `Uploaded → ${d.url}` : `Uploaded (private): ${d.key}`);
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (configured === false) {
    return (
      <div className="rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink">
        <p className="font-semibold">S3 not connected.</p>
        <p className="mt-1 text-slate">
          Set <code className="font-mono text-xs">S3_ASSETS_BUCKET</code> (+{" "}
          <code className="font-mono text-xs">ASSETS_CDN_URL</code> for public CloudFront URLs) and give the role
          S3 access. Until then, asset upload is off.
        </p>
      </div>
    );
  }

  const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

  return (
    <>
      <form onSubmit={onUpload} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-ink">File</span>
          <input type="file" name="file" required className={`${input} w-full`} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-ink">Visibility</span>
          <select name="visibility" defaultValue="public" className={input}>
            <option value="public">Public (CloudFront)</option>
            <option value="private">Private (signed)</option>
          </select>
        </label>
        <button type="submit" disabled={busy} className="btn-ink disabled:opacity-50">
          {busy ? "Uploading…" : "Upload"}
        </button>
        {msg && <p className="w-full break-all font-mono text-xs text-field">{msg}</p>}
      </form>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-slate">No assets yet. Upload a logo or image to start.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <div key={a.key} className="card overflow-hidden p-0">
              <div className="grid h-36 place-items-center border-b border-line bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {isImage(a.key) ? (
                  <img src={a.url} alt={a.key} className="max-h-36 max-w-full object-contain" />
                ) : (
                  <span className="font-mono text-xs text-slate">{a.key.split(".").pop()?.toUpperCase()}</span>
                )}
              </div>
              <div className="p-4">
                <p className="truncate text-sm font-semibold text-ink">{a.key.split("/").pop()}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate">
                  <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase ${a.visibility === "public" ? "bg-field/15 text-field" : "bg-line text-slate"}`}>
                    {a.visibility}
                  </span>
                  {fmtSize(a.size)}
                </p>
                <div className="mt-3 flex gap-2">
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn-ghost flex-1 px-2 py-1 text-xs">
                    Open
                  </a>
                  <button onClick={() => navigator.clipboard?.writeText(a.url)} className="btn-ghost px-2 py-1 text-xs">
                    Copy URL
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
