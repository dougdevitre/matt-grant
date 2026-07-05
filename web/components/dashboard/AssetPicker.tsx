"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isPublicImage, isStudioGraphic, type MediaSource, type PickerAsset } from "@/lib/social/assetMedia";

export type { PickerAsset };

// A modal picker for choosing an image from the whole media center — the Assets
// library, the Graphics-studio output, and the private Photo library — in one place.
// Reused by the Social composer (and available to other composers later).
//
// Assets/Studio tabs show only PUBLIC images: private assets are served via
// short-lived presigned URLs that expire before a scheduled post sends and that
// social networks can't reliably fetch, so they're not valid post media as-is.
// The Photos tab shows the private shoot library; picking one PROMOTES it to a
// stable public copy on select (POST /api/assets/promote) so it becomes postable.
// The chosen (or promoted) asset's stable CloudFront URL flows straight through
// sanitizeMediaUrl + publish.ts unchanged.

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

type PhotoGroup = { category: string; items: { key: string; name: string; url: string }[] };

const TABS: { id: MediaSource; label: string }[] = [
  { id: "assets", label: "Assets" },
  { id: "studio", label: "Studio" },
  { id: "photos", label: "Photos" },
];

export function AssetPicker({
  onSelect,
  trigger,
}: {
  onSelect: (a: PickerAsset) => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MediaSource>("assets");
  const [assets, setAssets] = useState<PickerAsset[]>([]);
  const [photos, setPhotos] = useState<PickerAsset[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [promoting, setPromoting] = useState<string | null>(null); // key being promoted
  const [error, setError] = useState<string | null>(null);

  // Assets + Studio share one fetch: Studio graphics are a tagged subset of public assets.
  const loadAssets = useCallback(() => {
    setAssetsLoaded(false);
    fetch("/api/assets/list")
      .then(safeJson)
      .then((d) => {
        setConfigured((c) => (c === false ? c : !!d.configured));
        setAssets(((d.items as PickerAsset[]) ?? []).filter((a) => a.kind === "image"));
      })
      .catch(() => setConfigured(false))
      .finally(() => setAssetsLoaded(true));
  }, []);

  const loadPhotos = useCallback(() => {
    setPhotosLoaded(false);
    fetch("/api/assets/photos")
      .then(safeJson)
      .then((d) => {
        setConfigured((c) => (c === false ? c : !!d.configured));
        const groups = (d.groups as PhotoGroup[]) ?? [];
        setPhotos(
          groups.flatMap((g) =>
            g.items.map((it) => ({
              key: it.key,
              name: it.name,
              kind: "image" as const,
              visibility: "private" as const,
              url: it.url,
              tags: [g.category],
              source: "photos" as const,
            })),
          ),
        );
      })
      .catch(() => setConfigured(false))
      .finally(() => setPhotosLoaded(true));
  }, []);

  // Lazy-load each source the first time it's needed.
  useEffect(() => {
    if (!open) return;
    if ((tab === "assets" || tab === "studio") && !assetsLoaded) loadAssets();
    if (tab === "photos" && !photosLoaded) loadPhotos();
  }, [open, tab, assetsLoaded, photosLoaded, loadAssets, loadPhotos]);

  const loaded = tab === "photos" ? photosLoaded : assetsLoaded;
  const items = useMemo(() => {
    if (tab === "photos") return photos;
    if (tab === "studio") return assets.filter(isStudioGraphic);
    return assets.filter(isPublicImage);
  }, [tab, assets, photos]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (a) => a.name.toLowerCase().includes(needle) || (a.tags ?? []).some((t) => t.toLowerCase().includes(needle)),
    );
  }, [items, q]);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const choose = async (a: PickerAsset) => {
    setError(null);
    // Public images (Assets/Studio) are postable as-is. A private photo must first be
    // promoted to a stable public copy — a short-lived signed URL would expire before
    // a scheduled drain fires and social networks can't fetch it.
    if (a.visibility === "private") {
      setPromoting(a.key);
      try {
        const res = await fetch("/api/assets/promote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: a.key }),
        });
        const d = await safeJson(res);
        if (!res.ok || !d.url) {
          setError((d.error as string) ?? "Couldn't prepare that image.");
          return;
        }
        onSelect({ key: d.key as string, name: d.name as string, kind: "image", visibility: "public", url: d.url as string, source: "photos" });
        close();
      } catch {
        setError("Couldn't prepare that image.");
      } finally {
        setPromoting(null);
      }
      return;
    }
    onSelect(a);
    close();
  };

  const emptyMsg =
    tab === "photos"
      ? "No shoot photos yet — add originals with the sync-photos.mjs script."
      : tab === "studio"
        ? "No Studio graphics yet — generate one under Graphics and click “Save to library.”"
        : "No public images yet — upload one under Assets (set its visibility to Public).";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-sm">
        {trigger ?? "Choose from the media library"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Choose an image from the media library"
          onClick={close}
        >
          <div className="mt-4 w-full max-w-3xl rounded-md bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-ink">Choose an image</h2>
              <button type="button" onClick={close} className="text-sm text-slate hover:text-ink" aria-label="Close">
                ✕
              </button>
            </div>

            {/* Source tabs — Assets, Studio graphics, and the private Photo library. */}
            <div className="mt-3 flex gap-1 border-b border-line" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => {
                    setTab(t.id);
                    setQ("");
                    setError(null);
                  }}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                    tab === t.id ? "border-ink text-ink" : "border-transparent text-slate hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "photos" && (
              <p className="mt-3 rounded-sm bg-paper px-3 py-2 text-xs text-slate">
                Shoot photos are staff-only. Picking one publishes a <span className="font-medium text-ink">permanent public copy</span> so
                it can be attached — the original stays private. Remove the copy anytime from <span className="font-mono">Assets</span> (it&apos;s
                tagged <span className="font-mono">social</span>).
              </p>
            )}

            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or tag…"
              className="mt-3 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field"
            />

            {error && <p className="mt-3 text-sm text-brick">{error}</p>}

            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              {!loaded ? (
                <p className="py-10 text-center text-sm text-slate">Loading…</p>
              ) : configured === false ? (
                <p className="py-10 text-center text-sm text-slate">
                  The media library isn&apos;t configured yet. Set it up under <span className="font-mono">Assets</span>.
                </p>
              ) : shown.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate">{items.length === 0 ? emptyMsg : "No images match that search."}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {shown.map((a) => {
                    const busy = promoting === a.key;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        disabled={!!promoting}
                        onClick={() => choose(a)}
                        className="group relative overflow-hidden rounded-sm border border-line text-left hover:border-field disabled:opacity-60"
                      >
                        <div className="aspect-video overflow-hidden bg-paper">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                        </div>
                        <p className="truncate px-2 py-1.5 text-xs text-slate group-hover:text-ink">{a.name}</p>
                        {busy && (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-semibold text-ink">
                            Preparing…
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
