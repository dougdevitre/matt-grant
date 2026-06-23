"use client";

import { useEffect, useMemo, useState } from "react";

type PhotoItem = { key: string; name: string; url: string; size: number; lastModified: string };
type Group = { category: string; items: PhotoItem[] };

const promoteCmd = (key: string, name: string) =>
  `node scripts/promote-photo.mjs --key ${key} --name ${name} --alt ""`;

export function PhotoLibrary() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [cat, setCat] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/assets/photos")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(Boolean(d.configured));
        setGroups(Array.isArray(d.groups) ? d.groups : []);
      })
      .catch(() => setConfigured(false));
  }, []);

  const cats = useMemo(() => ["all", ...groups.filter((g) => g.items.length).map((g) => g.category)], [groups]);
  const shown = cat === "all" ? groups : groups.filter((g) => g.category === cat);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  function copy(key: string, name: string) {
    navigator.clipboard?.writeText(promoteCmd(key, name.replace(/\.[^.]+$/, "")));
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (configured === false) {
    return (
      <div className="card border-dashed p-5 text-sm text-slate">
        S3 isn&apos;t configured in this environment, so the private library can&apos;t be listed here.
      </div>
    );
  }
  if (configured === null) return <p className="text-sm text-slate">Loading…</p>;
  if (!total) {
    return (
      <div className="card border-dashed p-5 text-sm text-slate">
        No photos yet. Upload a shoot with{" "}
        <span className="font-mono">node scripts/sync-photos.mjs --src &lt;folder&gt; --category events</span>.
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              cat === c ? "border-gold bg-gold/15 text-gold" : "border-line text-slate hover:border-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {shown.map((g) =>
        g.items.length ? (
          <section key={g.category} className="mb-8">
            <p className="eyebrow mb-3 capitalize text-slate">{g.category} · {g.items.length}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((p) => (
                <figure key={p.key} className="overflow-hidden rounded-sm border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="aspect-square w-full bg-paper object-cover" loading="lazy" />
                  <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="truncate text-[0.65rem] text-slate" title={p.name}>{p.name}</span>
                    <button
                      onClick={() => copy(p.key, p.name)}
                      className="shrink-0 rounded-sm border border-line px-2.5 py-1 text-[0.6rem] font-semibold text-field hover:border-ink"
                      title="Copy the promote-photo command"
                      aria-label={`Copy the promote command for ${p.name}`}
                    >
                      {copied === p.key ? "✓" : "Promote"}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </>
  );
}
