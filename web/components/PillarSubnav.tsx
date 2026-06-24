"use client";

import Link from "next/link";
import { useOnSubdomain } from "@/lib/use-on-subdomain";
import { pillarHref } from "@/lib/site";

// Secondary nav strip for a pillar's own synced docs/tools, so visitors can jump
// between them from any sub-page. Rendered by the [pillar] layout BELOW the shared
// SiteHeader — the apex chrome is never touched (zero drift). Links use pillarHref
// so they're clean (/doc) on the subdomain and canonical on the apex. The layout
// only mounts this when the manifest has content, so un-synced hubs are unchanged.
export function PillarSubnav({
  slug,
  eyebrow,
  docs,
  tools,
}: {
  slug: string;
  eyebrow: string;
  docs: { slug: string; title: string }[];
  tools: { slug: string; label: string }[];
}) {
  const onSubdomain = useOnSubdomain();
  return (
    <nav aria-label={`${eyebrow} resources`} className="border-b border-line bg-paper">
      <div className="container-page flex flex-wrap items-center gap-x-5 gap-y-2 py-3 text-sm">
        <Link
          href={pillarHref(slug, "", onSubdomain)}
          className="font-mono text-xs uppercase tracking-eyebrow text-brick hover:text-ink"
        >
          {eyebrow}
        </Link>
        {docs.map((d) => (
          <Link
            key={d.slug}
            href={pillarHref(slug, `/${d.slug}`, onSubdomain)}
            className="text-slate hover:text-ink"
          >
            {d.title}
          </Link>
        ))}
        {tools.map((t) => (
          <Link
            key={t.slug}
            href={pillarHref(slug, `/tools/${t.slug}`, onSubdomain)}
            className="font-semibold text-field hover:text-ink"
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
