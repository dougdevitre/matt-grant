"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useOnSubdomain } from "@/lib/use-on-subdomain";
import { pillarHref } from "@/lib/site";

// Client wrapper around next/link that renders a pillar-internal link as a clean
// path (/iep-guide) when viewed on the pillar's subdomain, and the canonical
// /pillars/<slug>/… form on the apex. See pillarHref in lib/site.ts. `path` is
// the within-pillar path ("" = hub, "/doc", "/tools/x"). The server renders the
// canonical form; the clean form applies after hydration on the subdomain.
export function PillarLink({
  slug,
  path,
  className,
  children,
}: {
  slug: string;
  path: string;
  className?: string;
  children: ReactNode;
}) {
  const onSubdomain = useOnSubdomain();
  return (
    <Link href={pillarHref(slug, path, onSubdomain)} className={className}>
      {children}
    </Link>
  );
}
