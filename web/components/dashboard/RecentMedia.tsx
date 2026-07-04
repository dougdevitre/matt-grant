"use client";

import { useEffect, useState } from "react";
import { isPublicImage, type PickerAsset } from "@/lib/social/assetMedia";

// A one-click rail of the most recent post-ready images, shown inline in the Social
// composer so the common case (reuse the graphic I just made, or a recent upload)
// skips the picker modal entirely. Backed by /api/assets/list, which already returns
// public assets newest-first; we keep only public images (postable as-is — private
// photos still go through the picker's promote-on-select). Silent until loaded and
// silent when empty, so it never adds noise before there's anything to reuse.
export function RecentMedia({
  onSelect,
  selectedKey,
  limit = 6,
}: {
  onSelect: (a: PickerAsset) => void;
  selectedKey?: string;
  limit?: number;
}) {
  const [items, setItems] = useState<PickerAsset[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/assets/list")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (alive) setItems(((d.items as PickerAsset[]) ?? []).filter(isPublicImage).slice(0, limit));
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [limit]);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-slate">Recent</p>
      <div className="flex flex-wrap gap-2">
        {items.map((a) => {
          const active = a.key === selectedKey;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onSelect(a)}
              title={a.name}
              aria-label={`Use ${a.name}`}
              aria-pressed={active}
              className={`h-14 w-14 overflow-hidden rounded-sm border transition-colors ${
                active ? "border-field ring-1 ring-field" : "border-line hover:border-field"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
