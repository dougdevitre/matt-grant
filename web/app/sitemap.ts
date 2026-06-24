import type { MetadataRoute } from "next";
import { publicPillars } from "@/lib/pillars";
import { getManifest } from "@/lib/pillars-content";

const BASE = "https://mattgrantforcongress.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/about", "/donate", "/press", "/contact", "/data-policy", "/transparency", "/public-trust"];
  const apex: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
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
