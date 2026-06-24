// Turn an arbitrary string (a social caption's first line, a studio headline) into
// a clean graphic headline: trim to a WORD BOUNDARY (never mid-word), drop trailing
// punctuation, and append "…" only when it actually had to cut. Returned unchanged
// when already within `max`. Pure + isomorphic so the composer preview and the
// /api/graphics renderer share one rule.

export function trimHeadline(text: string, max: number): string {
  const base = String(text ?? "").replace(/\s+/g, " ").trim();
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Prefer the last word boundary, but don't trim so aggressively that we lose most
  // of the text (e.g. one very long word) — fall back to the hard cut then.
  const sliced = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  const cleaned = sliced.replace(/[\s.,;:!?–—-]+$/, "");
  return `${cleaned}…`;
}
