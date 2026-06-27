import { CTA_THUMBS, type CtaThumb, type CtaThumbKey } from "./cta-manifest.generated";

// Context-aware mapping: which generated thumbnail a strong CTA shows, keyed by a
// short "context" string the caller passes (usually the destination section —
// "donate", "act", "issues"). Decoupled from the generated manifest so we can
// remap a CTA to a different image without re-running the pipeline.
//
// SAFETY: a context with no mapping — or one mapped to a thumb that wasn't
// generated this build — resolves to null, and <CtaButton> renders text-only.
// There is never a broken image; adding an image is purely additive.
const CTA_IMAGE_BY_CONTEXT: Partial<Record<string, CtaThumbKey>> = {
  donate: "donate",
  act: "act",
  issues: "issues",
};

export function ctaThumb(context?: string): CtaThumb | null {
  if (!context) return null;
  const key = CTA_IMAGE_BY_CONTEXT[context];
  return (key && CTA_THUMBS[key]) || null;
}

// Derives a context key from a route so nav links can opt into a thumbnail
// without hardcoding the mapping at every call site: "/act" → "act",
// "/issues" → "issues", "/vote/absentee" → "vote" (no image → text-only).
export function ctaThumbForHref(href: string): CtaThumb | null {
  return ctaThumb(href.split("/").filter(Boolean)[0]);
}
