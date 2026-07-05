// Recent-coverage enrichment via Google News RSS. Free, no key, and structured
// (parsed with fast-xml-parser, already a dep). Presented as LINKED headlines with
// source + date — factual and sourced, never our characterization (consistent with
// the research tool's "cite the source, not this dashboard" rule).
import { XMLParser } from "fast-xml-parser";
import { fetchTextWithRetry } from "@/lib/integrations/http";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
const UA = "Mozilla/5.0 (compatible; MattGrantForCongress research)";

export type NewsItem = { title: string; url: string; source: string | null; date: string | null };
export type NewsFeed = { items: NewsItem[]; retrievedAt: string };

type RssItem = { title?: unknown; link?: unknown; pubDate?: unknown; source?: unknown };

// Relevance guard: require the candidate's full name in the headline. Google News
// RSS phrase matching is loose — a "Chuck Summers" query returns an unrelated
// Summers obituary, a "Nick Vivio" query returns a Trump piece. Without this,
// low-profile challengers get noisy, misleading coverage. Conservative on purpose:
// fewer-but-correct beats more-but-wrong in an oppo-research tool.
export function headlineMatches(name: string, title: string): boolean {
  return title.toLowerCase().includes(name.trim().toLowerCase());
}

export async function fetchNews(name: string, maxItems = 6): Promise<NewsFeed | null> {
  const q = encodeURIComponent(`"${name}" Missouri`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

  let xml: string;
  try {
    // Shared transport (text variant): gains retry + Retry-After; stays best-effort.
    xml = await fetchTextWithRetry(url, { headers: { "user-agent": UA }, timeoutMs: 8000, retries: 1, label: "news" });
  } catch {
    return null; // best-effort; never block on news
  }

  let doc: { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }

  const raw = doc?.rss?.channel?.item;
  const arr: RssItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const items: NewsItem[] = arr
    .map((it) => {
      // Google News titles are "Headline - Publisher"; strip the trailing source.
      const title = String(it.title ?? "").replace(/\s+-\s+[^-]+$/, "").trim();
      const src = it.source as { "#text"?: unknown } | string | undefined;
      const source = typeof src === "object" && src ? (src["#text"] != null ? String(src["#text"]) : null) : src ? String(src) : null;
      // Guard the date parse: a single malformed <pubDate> (e.g. "garbage" or just
      // whitespace) makes new Date(...) Invalid, and .toISOString() throws RangeError
      // — which, since this map runs outside the parse try/catch, would reject the
      // whole feed and drop EVERY headline for the candidate, not just the bad item.
      const parsedDate = it.pubDate ? new Date(String(it.pubDate)) : null;
      const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;
      return { title, url: String(it.link ?? ""), source, date };
    })
    .filter((i) => i.title && i.url && headlineMatches(name, i.title));

  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { items: items.slice(0, maxItems), retrievedAt: new Date().toISOString() };
}
