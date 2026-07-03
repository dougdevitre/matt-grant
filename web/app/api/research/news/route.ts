import { loadField } from "@/lib/integrations/research/candidates";
import { fetchNews } from "@/lib/integrations/news/client";
import { persistNews } from "@/lib/integrations/research/store";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobOk, unauthorized } from "@/lib/jobResult";

// Fast recent-coverage refresh (Google News RSS), sequential and decoupled from
// the heavy field ingest. Persists per candidate and returns a count so it's
// directly observable. CRON_SECRET-gated. ?slug=X for one, or all.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  if (!(await cronAuthorized(req))) return unauthorized();
  const slug = new URL(req.url).searchParams.get("slug");
  const field = loadField().filter((c) => c.active !== false);
  const targets = slug ? field.filter((c) => c.slug === slug) : field;

  const results: Record<string, unknown> = {};
  for (const c of targets) {
    try {
      const feed = await fetchNews(c.name);
      if (feed && feed.items.length) {
        await persistNews(c.slug, feed);
        results[c.slug] = { name: c.name, items: feed.items.length, latest: feed.items[0]?.title };
      } else {
        results[c.slug] = { name: c.name, items: 0 };
      }
    } catch (err) {
      console.error(`[api] research/news ${c.slug}:`, err); // log real error; don't leak it
      results[c.slug] = { name: c.name, error: "fetch failed" };
    }
  }
  return jobOk({ count: targets.length, results });
}

export const GET = handle;
export const POST = handle;
