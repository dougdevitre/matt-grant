"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Kind = "image" | "pdf" | "other";
type Asset = {
  key: string;
  name: string;
  kind: Kind;
  size: number;
  lastModified: string;
  visibility: "public" | "private";
  url: string;
  tags: string[];
  uploadedBy?: string;
  originalSize?: number;
};

const isImage = (key: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(key);
const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const kindLabel: Record<Kind, string> = { image: "Image", pdf: "PDF", other: "File" };

const KINDS: { value: string; label: string }[] = [
  { value: "ALL", label: "All types" },
  { value: "image", label: "Images" },
  { value: "pdf", label: "PDFs" },
  { value: "other", label: "Other" },
];
const SORTS: { value: string; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "old", label: "Oldest" },
  { value: "name", label: "Name A–Z" },
  { value: "large", label: "Largest" },
  { value: "small", label: "Smallest" },
];

// Guard against non-JSON / empty responses (a 413, an auth redirect, a proxy error)
// so the UI shows a real message instead of "Unexpected end of JSON input".
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: `HTTP ${res.status}` };
  }
}

export function AssetManager() {
  const [items, setItems] = useState<Asset[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Toolbar state
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("ALL");
  const [vis, setVis] = useState("ALL");
  const [tag, setTag] = useState("ALL");
  const [sort, setSort] = useState("new");
  const [view, setView] = useState<"grid" | "list">("grid");

  const load = useCallback(() => {
    fetch("/api/assets/list")
      .then(safeJson)
      .then((d) => {
        setConfigured(!!d.configured);
        setItems((d.items as Asset[]) ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);

  useEffect(load, [load]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    if (!(form.get("file") as File)?.size) return;
    // An unchecked checkbox is omitted from FormData, so set it explicitly — else
    // "Original quality" (unchecked) would read as absent and still optimize.
    const optEl = formEl.elements.namedItem("optimize") as HTMLInputElement | null;
    form.set("optimize", optEl?.checked ? "1" : "0");
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      const d = await safeJson(res);
      if (!res.ok) throw new Error((d.error as string) || `Upload failed (HTTP ${res.status})`);
      const savedPct = Number(d.savedPct ?? 0);
      const saved = savedPct > 0 ? ` · saved ${savedPct}% (${fmtSize(Number(d.originalSize))} → ${fmtSize(Number(d.size))})` : "";
      setMsg((d.url ? `Uploaded → ${d.url}` : `Uploaded (private): ${d.key}`) + saved);
      formEl.reset();
      load();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  // Persist a tag change for one asset; optimistic, with the fallback fields the
  // server needs to upsert a record for a legacy (pre-metadata) asset.
  const saveTags = useCallback((key: string, tags: string[]) => {
    setItems((cur) => cur.map((a) => (a.key === key ? { ...a, tags } : a)));
    const a = items.find((x) => x.key === key);
    fetch("/api/assets/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, tags, name: a?.name, visibility: a?.visibility, size: a?.size, kind: a?.kind }),
    }).catch(() => load());
  }, [items, load]);

  const allTags = useMemo(() => [...new Set(items.flatMap((a) => a.tags))].sort(), [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = items.filter((a) => {
      if (kind !== "ALL" && a.kind !== kind) return false;
      if (vis !== "ALL" && a.visibility !== vis) return false;
      if (tag !== "ALL" && !a.tags.includes(tag)) return false;
      if (needle && !`${a.name} ${a.tags.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by = {
      new: (a: Asset, b: Asset) => b.lastModified.localeCompare(a.lastModified),
      old: (a: Asset, b: Asset) => a.lastModified.localeCompare(b.lastModified),
      name: (a: Asset, b: Asset) => a.name.localeCompare(b.name),
      large: (a: Asset, b: Asset) => b.size - a.size,
      small: (a: Asset, b: Asset) => a.size - b.size,
    }[sort];
    return [...rows].sort(by);
  }, [items, q, kind, vis, tag, sort]);

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
        <label className="flex items-center gap-1.5 pb-2 text-xs text-slate" title="Re-encode images for the web (keeps the format). Uncheck to store a master at original quality.">
          <input type="checkbox" name="optimize" value="1" defaultChecked />
          Optimize for web
        </label>
        <button type="submit" disabled={busy} className="btn-ink disabled:opacity-50">
          {busy ? "Uploading…" : "Upload"}
        </button>
        {msg && <p className="w-full break-all font-mono text-xs text-field">{msg}</p>}
      </form>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-slate">No assets yet. Upload a logo or image to start.</div>
      ) : (
        <>
          {/* Toolbar: search · type · visibility · tag · sort · view */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or tag…"
              aria-label="Search assets"
              className={`${input} min-w-0 flex-1`}
            />
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type" className={input}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <select value={vis} onChange={(e) => setVis(e.target.value)} aria-label="Filter by visibility" className={input}>
              <option value="ALL">All visibility</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            {allTags.length > 0 && (
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className={input}>
                <option value="ALL">All tags</option>
                {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
              </select>
            )}
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={input}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div className="flex overflow-hidden rounded-sm border border-line">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-2 text-xs font-semibold ${view === v ? "bg-ink text-paper" : "bg-white text-ink hover:bg-paper"}`}
                  aria-pressed={view === v}
                >
                  {v === "grid" ? "Grid" : "List"}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 font-mono text-xs text-slate">{filtered.length} of {items.length}</p>

          {filtered.length === 0 ? (
            <div className="card p-10 text-center text-slate">No assets match these filters.</div>
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((a) => (
                <div key={a.key} className="card flex flex-col overflow-hidden p-0">
                  <div className="grid h-36 place-items-center border-b border-line bg-paper">
                    {isImage(a.key) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} className="max-h-36 max-w-full object-contain" />
                    ) : (
                      <span className="font-mono text-xs text-slate">{a.name.split(".").pop()?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="truncate text-sm font-semibold text-ink" title={a.name}>{a.name}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate">
                      <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.6rem] uppercase ${a.visibility === "public" ? "bg-field/15 text-field" : "bg-line text-slate"}`}>
                        {a.visibility}
                      </span>
                      <span className="font-mono text-[0.6rem] uppercase text-slate">{kindLabel[a.kind]}</span>
                      {fmtSize(a.size)} · {fmtDate(a.lastModified)}
                    </p>
                    <TagEditor tags={a.tags} onChange={(t) => saveTags(a.key, t)} />
                    <div className="mt-3 flex gap-2">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn-ghost flex-1 px-2 py-1 text-xs">Open</a>
                      <button onClick={() => navigator.clipboard?.writeText(a.url)} className="btn-ghost px-2 py-1 text-xs">Copy URL</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="border-b border-line bg-paper text-left text-slate">
                    <tr>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-eyebrow">Name</th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-eyebrow">Type</th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-eyebrow">Tags</th>
                      <th className="px-4 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Size</th>
                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-eyebrow">Added</th>
                      <th className="px-4 py-3 text-right font-mono text-xs uppercase tracking-eyebrow">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((a) => (
                      <tr key={a.key} className="hover:bg-paper">
                        <td className="px-4 py-3">
                          <p className="truncate font-semibold text-ink" title={a.name}>{a.name}</p>
                          <span className={`mt-0.5 inline-block rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase ${a.visibility === "public" ? "bg-field/15 text-field" : "bg-line text-slate"}`}>{a.visibility}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs uppercase text-slate">{kindLabel[a.kind]}</td>
                        <td className="px-4 py-3"><TagEditor tags={a.tags} onChange={(t) => saveTags(a.key, t)} compact /></td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate">{fmtSize(a.size)}</td>
                        <td className="px-4 py-3 text-xs text-slate">{fmtDate(a.lastModified)}</td>
                        <td className="px-4 py-3 text-right">
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2 py-1 text-xs">Open</a>
                          <button onClick={() => navigator.clipboard?.writeText(a.url)} className="btn-ghost ml-1 px-2 py-1 text-xs">Copy</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// Inline tag chips + add-input. Calls onChange with the full new tag list; the parent
// persists. Tags are normalized (lowercased/trimmed) server-side too.
function TagEditor({ tags, onChange, compact }: { tags: string[]; onChange: (tags: string[]) => void; compact?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  };
  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "" : "mt-2"}`}>
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-field/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-field">
          #{t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="text-field/70 hover:text-brick">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="+ tag"
        aria-label="Add tag"
        className="w-16 rounded-sm border border-line bg-white px-1.5 py-0.5 text-[0.65rem] text-ink focus:border-field"
      />
    </div>
  );
}
