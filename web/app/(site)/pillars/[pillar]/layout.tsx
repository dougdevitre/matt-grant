import type { ReactNode } from "react";
import { getPillar } from "@/lib/pillars";
import { getManifest } from "@/lib/pillars-content";
import { PillarSubnav } from "@/components/PillarSubnav";

// Wraps every page under a pillar subdomain (hub, docs, tools). Reads the synced
// manifest server-side and, when there's content, renders a per-pillar sub-nav
// strip below the shared SiteHeader so the hub's own docs/tools are reachable from
// any sub-page. No content yet → no sub-nav, so un-synced hubs render unchanged.
export default async function PillarLayout({
  params,
  children,
}: {
  params: Promise<{ pillar: string }>;
  children: ReactNode;
}) {
  const { pillar: slug } = await params;
  const pillar = getPillar(slug);
  const manifest = pillar ? getManifest(slug) : null;
  const hasContent = !!manifest && (manifest.docs.length > 0 || manifest.tools.length > 0);

  return (
    <>
      {pillar && hasContent && (
        <PillarSubnav
          slug={pillar.slug}
          eyebrow={pillar.eyebrow}
          docs={manifest!.docs.map((d) => ({ slug: d.slug, title: d.title }))}
          tools={manifest!.tools.map((t) => ({ slug: t.slug, label: t.label }))}
        />
      )}
      {children}
    </>
  );
}
