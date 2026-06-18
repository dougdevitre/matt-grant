import type { MetadataRoute } from "next";

const BASE = "https://mattgrantforcongress.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/about", "/donate", "/press", "/contact", "/data-policy", "/transparency", "/public-trust"];
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
