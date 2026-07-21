import type { MetadataRoute } from "next";
import { publicPillars } from "@/lib/pillars";
import { getManifest } from "@/lib/pillars-content";

const BASE = "https://mattgrantforcongress.org";

export default function sitemap(): MetadataRoute.Sitemap {
  // Public, crawlable pages only. Auth-gated routes (/community, /join/captain,
  // /dashboard, /my-giving) are intentionally excluded — they 307 to /sign-in.
  const highPriority = ["/issues", "/join"];
  const routes = [
    "",
    "/about",
    "/issues",
    "/join",
    "/act",
    "/social",
    "/events",
    "/vote",
    "/vote/absentee",
    "/donate",
    "/press",
    "/press/schedule",
    "/media",
    "/data/mo-02-by-the-numbers",
    "/contact",
    "/data-policy",
    "/transparency",
    "/public-trust",
    "/terms",
  ];
  const apex: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : highPriority.includes(path) ? 0.8 : 0.7,
  }));

  // Each pillar resource hub plus any synced docs/tools, addressed by their
  // canonical apex path (/pillars/<slug>/…). The pillar SUBDOMAINS (e.g.
  // education.mattgrantforcongress.org) are referenced in middleware/links but are
  // NOT provisioned in DNS, so emitting them here produced 167 unresolvable URLs.
  // The apex paths serve identical content and are the canonical form regardless.
  const pillars: MetadataRoute.Sitemap = publicPillars.flatMap((p) => {
    const root = `${BASE}/pillars/${p.slug}`;
    const manifest = getManifest(p.slug);
    const docs = (manifest?.docs ?? []).map((d) => ({ url: `${root}/${d.slug}`, changeFrequency: "monthly" as const, priority: 0.5 }));
    const tools = (manifest?.tools ?? []).map((t) => ({ url: `${root}/tools/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.5 }));
    return [{ url: root, changeFrequency: "weekly" as const, priority: 0.6 }, ...docs, ...tools];
  });

  return [...apex, ...pillars];
}
