"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isPublicImage, type PickerAsset } from "@/lib/social/assetMedia";

export type { PickerAsset };

// A lean modal picker for choosing an image from the Assets library. Reused by the
// Social composer (and available to other composers later). Shows ONLY public
// images: private assets are served via short-lived presigned URLs that expire
// before a scheduled post sends and that social networks can't reliably fetch, so
// they're not valid post media. The chosen asset's stable CloudFront URL flows
// straight through sanitizeMediaUrl + publish.ts unchanged.

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

export function AssetPicker({
  onSelect,
  trigger,
}: {
  onSelect: (a: PickerAsset) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PickerAsset[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setLoaded(false);
    fetch("/api/assets/list")
      .then(safeJson)
      .then((d) => {
        setConfigured(!!d.configured);
        setItems(((d.items as PickerAsset[]) ?? []).filter(isPublicImage));
      })
      .catch(() => setConfigured(false))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (a) => a.name.toLowerCase().includes(needle) || (a.tags ?? []).some((t) => t.toLowerCase().includes(needle)),
    );
  }, [items, q]);

  const choose = (a: PickerAsset) => {
    onSelect(a);
    setOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-sm">
        {trigger ?? "Choose from the Assets library"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Choose an image from the Assets library"
          onClick={() => setOpen(false)}
        >
          <div className="mt-4 w-full max-w-3xl rounded-md bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-ink">Choose an image</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate hover:text-ink" aria-label="Close">
                ✕
              </button>
            </div>

            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or tag…"
              className="mt-3 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field"
            />

            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              {!loaded ? (
                <p className="py-10 text-center text-sm text-slate">Loading…</p>
              ) : configured === false ? (
                <p className="py-10 text-center text-sm text-slate">
                  The asset library isn&apos;t configured yet. Set it up under <span className="font-mono">Assets</span>.
                </p>
              ) : shown.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate">
                  {items.length === 0
                    ? "No public images yet — upload one under Assets (set its visibility to Public)."
                    : "No images match that search."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shown.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => choose(a)}
                      className="group overflow-hidden rounded-sm border border-line text-left hover:border-field"
                    >
                      <div className="aspect-video overflow-hidden bg-paper">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                      </div>
                      <p className="truncate px-2 py-1.5 text-xs text-slate group-hover:text-ink">{a.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
