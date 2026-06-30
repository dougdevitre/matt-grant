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
    "/events",
    "/vote",
    "/vote/absentee",
    "/donate",
    "/press",
    "/press/schedule",
    "/media",
    "/contact",
    "/data-policy",
    "/transparency",
    "/public-trust",
  ];
  const apex: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : highPriority.includes(path) ? 0.8 : 0.7,
  }));

  // Each pillar resource hub on its own subdomain, plus any synced docs/tools.
  const pillars: MetadataRoute.Sitemap = publicPillars.flatMap((p) => {
    const root = `https://${p.subdomain}.mattgrantforcongress.org`;
    const manifest = getManifest(p.slug);
    const docs = (manifest?.docs ?? []).map((d) => ({ url: `${root}/pillars/${p.slug}/${d.slug}`, changeFrequency: "monthly" as const, priority: 0.5 }));
    const tools = (manifest?.tools ?? []).map((t) => ({ url: `${root}/pillars/${p.slug}/tools/${t.slug}`, changeFrequency: "monthly" as const, priority: 0.5 }));
    return [{ url: root, changeFrequency: "weekly" as const, priority: 0.6 }, ...docs, ...tools];
  });

  return [...apex, ...pillars];
}
