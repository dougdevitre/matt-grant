// Pure helpers for using an Assets-library image as social post media. Kept free
// of JSX so it's unit-testable (the picker component imports from here).

export type PickerAsset = {
  key: string;
  name: string;
  kind: "image" | "pdf" | "other";
  visibility: "public" | "private";
  url: string;
  tags?: string[];
};

/**
 * Only PUBLIC IMAGES are valid social post media. Private assets are served via
 * short-lived presigned URLs that expire before a scheduled post sends and that
 * social networks can't reliably fetch; PDFs/other aren't images. This is the only
 * rule the picker filters on.
 */
export function isPublicImage(a: Pick<PickerAsset, "kind" | "visibility">): boolean {
  return a.kind === "image" && a.visibility === "public";
}
