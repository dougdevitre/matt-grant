import { pillarForHost } from "./pillars";

// Pure host→path mapping for the pillar-subdomain rewrite, factored out of
// middleware.ts so it's unit-testable without the Clerk/edge runtime.
//
// Returns the internal pathname a pillar subdomain should rewrite to, or null to
// pass the request through unchanged (apex, www, localhost, /api/*, and any path
// already under /pillars/*). Edge-safe (pure data, no node APIs).
export function pillarRewritePath(host: string | null | undefined, pathname: string): string | null {
  const pillar = pillarForHost(host);
  if (!pillar) return null;
  if (pathname.startsWith("/api/") || pathname.startsWith("/pillars/")) return null;
  return `/pillars/${pillar.slug}${pathname === "/" ? "" : pathname}`;
}
