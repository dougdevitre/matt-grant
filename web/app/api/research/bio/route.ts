import { loadField } from "@/lib/integrations/research/candidates";
import { fetchWikiBio } from "@/lib/integrations/wikipedia/client";
import { persistWikiBio } from "@/lib/integrations/research/store";
import { cronAuthorized } from "@/lib/cron-auth";
import { jobOk, unauthorized } from "@/lib/jobResult";

// Dedicated, fast Wikipedia-bio refresh — decoupled from the heavy field ingest
// (which can time out on the incumbent's FEC/congress queries). One bounded
// Wikipedia lookup per candidate, persisted; returns what it resolved so the
// result is directly observable. CRON_SECRET-gated like the ingest route.
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
      const bio = await fetchWikiBio(c.name, c.wikipediaTitle ?? undefined);
      if (bio) {
        await persistWikiBio(c.slug, bio);
        results[c.slug] = { name: c.name, title: bio.title, description: bio.description };
      } else {
        results[c.slug] = { name: c.name, bio: null };
      }
    } catch (err) {
      console.error(`[api] research/bio ${c.slug}:`, err); // log real error; don't leak it
      results[c.slug] = { name: c.name, error: "fetch failed" };
    }
  }
  return jobOk({ count: targets.length, results });
}

export const GET = handle;
export const POST = handle;
