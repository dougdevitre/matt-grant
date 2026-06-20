// Wikipedia bio enrichment for candidate profiles. Free, no key. Factual + fully
// sourced (links to the article). The risk in an oppo-research tool is grabbing
// the WRONG person's article, so auto-resolution is guarded: the summary must read
// as a politician AND mention the candidate's surname, or we return null. A roster
// can also pin an exact `wikipediaTitle` to skip resolution entirely.
import { fetchJsonWithRetry } from "../http";

const WP = "https://en.wikipedia.org";
// Wikimedia's User-Agent policy REQUIRES contact info; datacenter IPs (Lambda)
// are blocked/tarpitted without it. Bound tightly (short timeout, no retry) so a
// slow/blocked Wikipedia can never hang the ingest — bios are best-effort.
const UA = "MattGrantForCongress/1.0 (https://mattgrantforcongress.org; mattgrantforcongress@gmail.com)";
const headers = { "user-agent": UA, accept: "application/json" };
const BOUND = { timeoutMs: 7000, retries: 1 } as const;

type Json = Record<string, unknown>;

export type WikiBio = {
  title: string;
  description: string | null; // e.g. "American politician (born 1962)"
  extract: string; // intro paragraph
  url: string;
  thumbnail: string | null;
  retrievedAt: string;
};

const POLITICS = /\b(politician|congress|representative|senator|republican|democrat|missouri|u\.?s\.? house|candidate|state house|state senate|alderman|mayor)\b/i;

// The wrong-person guard, as a pure predicate so it can be unit-tested: an
// auto-resolved article is only trusted if it reads as a politician AND mentions
// the candidate's surname. This is what stops the tool from showing a different
// "Ann Wagner" (or anyone else) on a candidate's profile.
export function looksLikeCandidate(name: string, title: string, description: string | null, extract: string): boolean {
  const last = name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  const hay = `${title} ${description ?? ""} ${extract}`.toLowerCase();
  return POLITICS.test(hay) && last.length >= 3 && hay.includes(last);
}

async function summary(title: string): Promise<Json | null> {
  try {
    return await fetchJsonWithRetry<Json>(`${WP}/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers, ...BOUND, label: "wikipedia summary" });
  } catch {
    return null;
  }
}

async function searchTopTitle(query: string): Promise<string | null> {
  try {
    const d = await fetchJsonWithRetry<Json>(`${WP}/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=3`, { headers, ...BOUND, label: "wikipedia search" });
    const pages = (d.pages as Json[] | undefined) ?? [];
    const top = pages[0];
    return top ? (String(top.title ?? top.key ?? "") || null) : null;
  } catch {
    return null;
  }
}

export async function fetchWikiBio(name: string, titleOverride?: string | null): Promise<WikiBio | null> {
  const title = titleOverride || (await searchTopTitle(`${name} Missouri politician`));
  if (!title) return null;

  const s = await summary(title);
  if (!s || s.type === "disambiguation") return null;
  const extract = String(s.extract ?? "").trim();
  if (!extract) return null;
  const description = (s.description as string | undefined) ?? null;

  // Wrong-person guard — skip only when an exact title was pinned in the roster.
  if (!titleOverride && !looksLikeCandidate(name, title, description, extract)) return null;

  const desktop = (s.content_urls as Json | undefined)?.desktop as Json | undefined;
  return {
    title: String(s.title ?? title),
    description,
    extract,
    url: (desktop?.page as string) ?? `${WP}/wiki/${encodeURIComponent(title)}`,
    thumbnail: ((s.thumbnail as Json | undefined)?.source as string) ?? null,
    retrievedAt: new Date().toISOString(),
  };
}
