// Pure helpers for using an Assets-library image as social post media. Kept free
// of JSX so it's unit-testable (the picker component imports from here).

// Where a picker item came from — the composer's unified media picker draws from
// all three media-center surfaces: the Assets library, the Studio graphics (a
// tagged subset of public assets), and the private Photo library.
export type MediaSource = "assets" | "studio" | "photos";

export type PickerAsset = {
  key: string;
  name: string;
  kind: "image" | "pdf" | "other";
  visibility: "public" | "private";
  url: string;
  tags?: string[];
  source?: MediaSource;
};

/**
 * Only PUBLIC IMAGES are valid social post media as-is. Private assets are served
 * via short-lived presigned URLs that expire before a scheduled post sends and that
 * social networks can't reliably fetch; PDFs/other aren't images. This is the rule
 * the Assets/Studio tabs filter on. Private photos are made postable on select by
 * promoting them to a stable public copy (see promoteMedia.ts) — they are NOT shown
 * by this filter.
 */
export function isPublicImage(a: Pick<PickerAsset, "kind" | "visibility">): boolean {
  return a.kind === "image" && a.visibility === "public";
}

/**
 * A public image that came out of the Graphics Studio. Studio saves its PNGs to the
 * public asset library tagged "studio"; older ones predate the tag, so also match the
 * `matt-grant-<format>.png` name the Studio writes. Lets the picker offer a Studio tab
 * without a separate data source.
 */
export function isStudioGraphic(a: Pick<PickerAsset, "kind" | "visibility" | "name" | "tags">): boolean {
  if (!isPublicImage(a)) return false;
  return (a.tags ?? []).includes("studio") || /^matt-grant-/i.test(a.name);
}

/**
 * Stable public key for a promoted private object:
 * `private/photos/events/a.jpg` → `public/social/photos-events-a.jpg`. Deterministic
 * so re-promoting the same photo overwrites the same object instead of duplicating it.
 * Pure (no S3/sharp deps) so it stays unit-testable; promoteMedia.ts imports it.
 */
export function publicSocialKey(sourceKey: string): string {
  const base = sourceKey
    .replace(/^private\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `public/social/${base}`;
}
