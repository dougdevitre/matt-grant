import { pillarForHost, pillarSlugs } from "./pillars";

const MAIN = "https://mattgrantforcongress.org";
const APEX_DOMAIN = "mattgrantforcongress.org";

// Reserved single-label subdomains that map to a fixed internal route prefix. These
// are FIRST-PARTY app sections served on their own subdomain — NOT pillar microsites
// (lib/pillars.ts, which rewrite to /pillars/<slug>) and NOT vanity issue redirects
// (ISSUE_VANITY, which 308 to the apex). games. hosts the civic mini-game arcade,
// served in-app at /games. Add a label here and it's recognized everywhere the
// routing + drift logic below consults it.
export const RESERVED_SUBDOMAINS: Record<string, string> = {
  games: "/games",
};

// Vanity subdomains for the four documented priorities. Each is a short marketing
// alias that 308-redirects to the canonical /issues/<slug> page on the apex — one
// source of truth, no duplicate content. Labels are intentionally distinct from the
// resource-pillar labels in lib/pillars.ts (e.g. justice. stays the legal-aid hub).
// Values MUST match real slugs in lib/issues.ts (asserted by the unit test).
export const ISSUE_VANITY: Record<string, string> = {
  courts: "family-courts",
  limits: "term-limits",
  lean: "smaller-government",
  taxes: "lower-taxes",
};

// Absolute apex URL a vanity issue subdomain should redirect to, or null if the
// host isn't a vanity label. Path/query are dropped — the alias always lands on the
// canonical issue page.
export function issueVanityRedirect(host: string | null | undefined): string | null {
  if (!host) return null;
  const label = host.split(":")[0].split(".")[0].toLowerCase();
  const slug = ISSUE_VANITY[label];
  return slug ? `${MAIN}/issues/${slug}` : null;
}

// A single-level subdomain of the campaign apex that the app doesn't recognize —
// i.e. not www, not a known pillar, not a vanity issue alias. Returns the label so
// the middleware can log it (wildcard DNS sends every label here, so an unknown one
// means catalog/DNS drift or a typo). Returns null for the apex, www, multi-level
// hosts, foreign domains, and every known label. Pure + edge-safe.
export function unknownPillarSubdomain(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const suffix = `.${APEX_DOMAIN}`;
  if (!hostname.endsWith(suffix)) return null; // apex itself or a foreign domain
  const label = hostname.slice(0, -suffix.length);
  if (!label || label === "www" || label.includes(".")) return null; // apex/www/multi-level
  if (pillarSlugs.includes(label) || label in ISSUE_VANITY || label in RESERVED_SUBDOMAINS) return null; // known
  return label;
}

// Pure host→path mapping for a reserved subdomain (e.g. games.) → its internal route.
// Returns the rewrite target, or null to pass the request through (not a reserved
// label, /api/*, or a path already under the reserved prefix). Edge-safe + pure, so
// it's unit-testable without the Clerk/edge runtime. Mirrors pillarRewritePath.
export function reservedSubdomainRewrite(host: string | null | undefined, pathname: string): string | null {
  if (!host) return null;
  const label = host.split(":")[0].split(".")[0].toLowerCase();
  const base = RESERVED_SUBDOMAINS[label];
  if (!base) return null;
  if (pathname.startsWith("/api/") || pathname === base || pathname.startsWith(`${base}/`)) return null;
  return `${base}${pathname === "/" ? "" : pathname}`;
}

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
