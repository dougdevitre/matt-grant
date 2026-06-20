// Recent-coverage enrichment via Google News RSS. Free, no key, and structured
// (parsed with fast-xml-parser, already a dep). Presented as LINKED headlines with
// source + date — factual and sourced, never our characterization (consistent with
// the research tool's "cite the source, not this dashboard" rule).
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
const UA = "Mozilla/5.0 (compatible; MattGrantForCongress research)";

export type NewsItem = { title: string; url: string; source: string | null; date: string | null };
export type NewsFeed = { items: NewsItem[]; retrievedAt: string };

type RssItem = { title?: unknown; link?: unknown; pubDate?: unknown; source?: unknown };

export async function fetchNews(name: string, maxItems = 6): Promise<NewsFeed | null> {
  const q = encodeURIComponent(`"${name}" Missouri`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

  let xml: string;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    xml = await res.text();
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
      const date = it.pubDate ? new Date(String(it.pubDate)).toISOString() : null;
      return { title, url: String(it.link ?? ""), source, date };
    })
    .filter((i) => i.title && i.url);

  items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { items: items.slice(0, maxItems), retrievedAt: new Date().toISOString() };
}
