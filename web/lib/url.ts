// Guard for hrefs built from externally-ingested data (Wikipedia, Google News,
// FEC/alignment sources, candidate-supplied sites). React does NOT neutralize a
// `javascript:` or `data:` URL in an <a href>, so an anchor built from an
// untrusted string could execute on click. externalHttpUrl returns the URL only
// when it parses as an absolute http/https URL, and undefined otherwise — the
// caller renders the anchor inert (or omits it) rather than as a live link.
export function externalHttpUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined; // relative or unparseable → not a safe external link
  }
}
