// Pillar resource hubs — one per dougdevitre/access-to-* repo, each served at its
// own subdomain (e.g. education.mattgrantforcongress.org) via the host rewrite in
// middleware.ts. Mirrors the data-driven pattern of lib/issues.ts.
//
// IMPORTANT — framing guardrail: these are NONPARTISAN constituent-resource hubs,
// not Matt Grant policy positions. Only the four documented priorities in
// lib/issues.ts make policy claims. Blurbs here describe the resource the hub
// points people to; they must not state or imply a new campaign position. Keep
// faithful — see CLAUDE.md ("No invented facts or law").
//
// This module is PURE DATA (no node:fs) so it stays edge-safe for middleware and
// safe to import from client components. Synced repo content is loaded separately
// by lib/pillars-content.ts (server-only).

export type PillarTool = { slug: string; label: string; file: string };

export type Pillar = {
  slug: string; // "education" → education.mattgrantforcongress.org
  subdomain: string; // usually === slug
  sourceRepo: string; // "dougdevitre/access-to-education"
  sourceUrl: string; // https://github.com/dougdevitre/access-to-education
  kind: "resource";
  eyebrow: string; // "Access to Education"
  title: string;
  tagline: string;
  // MO-02-framed intro — RESOURCE language only, no policy claims.
  blurb: string;
  // Optional cross-link to a documented priority page at /issues/<slug>.
  relatedIssue?: string;
};

const repo = (name: string) => `dougdevitre/${name}`;
const ghUrl = (name: string) => `https://github.com/dougdevitre/${name}`;

export const PILLARS: Pillar[] = [
  {
    slug: "education",
    subdomain: "education",
    sourceRepo: repo("access-to-education"),
    sourceUrl: ghUrl("access-to-education"),
    kind: "resource",
    eyebrow: "Access to Education",
    title: "Education resources for MO-02 families",
    tagline: "Navigate special education, IEPs, and family–school communication.",
    blurb:
      "A nonpartisan navigator for families in Missouri's 2nd District working through special-education support — understanding IEPs, communicating with schools, and finding advocacy resources. These are informational tools, not legal advice.",
    relatedIssue: "family-courts",
  },
  {
    slug: "jobs",
    subdomain: "jobs",
    sourceRepo: repo("access-to-jobs"),
    sourceUrl: ghUrl("access-to-jobs"),
    kind: "resource",
    eyebrow: "Access to Jobs",
    title: "Workforce resources for MO-02",
    tagline: "Job matching, resume tools, and WIOA workforce navigation.",
    blurb:
      "A nonpartisan Missouri workforce navigator — job-matching, resume help, and guidance on WIOA-funded programs for neighbors in MO-02. Informational resource navigation, not a guarantee of services.",
  },
  {
    slug: "housing",
    subdomain: "housing",
    sourceRepo: repo("access-to-housing"),
    sourceUrl: ghUrl("access-to-housing"),
    kind: "resource",
    eyebrow: "Access to Housing",
    title: "Housing resources for MO-02",
    tagline: "Tenant resources, fair-housing guides, and screening tools.",
    blurb:
      "A nonpartisan guide to housing access in MO-02 — tenant resources, fair-housing information, and advocacy tools. Informational only; not legal advice.",
  },
  {
    slug: "food",
    subdomain: "food",
    sourceRepo: repo("access-to-food"),
    sourceUrl: ghUrl("access-to-food"),
    kind: "resource",
    eyebrow: "Access to Food",
    title: "Food &amp; nutrition resources for MO-02",
    tagline: "Food-bank locators and SNAP/WIC navigation.",
    blurb:
      "A nonpartisan navigator for food access in MO-02 — finding food banks and understanding SNAP/WIC and community nutrition resources. Informational resource navigation only.",
  },
  {
    slug: "health",
    subdomain: "health",
    sourceRepo: repo("access-to-health"),
    sourceUrl: ghUrl("access-to-health"),
    kind: "resource",
    eyebrow: "Access to Health",
    title: "Public-health resources for MO-02",
    tagline: "Standards-grounded guidance for practitioners and families.",
    blurb:
      "A nonpartisan public-health resource hub — role-based guidance grounded in published standards. Informational only; not medical advice.",
  },
  {
    slug: "justice",
    subdomain: "justice",
    sourceRepo: repo("access-to-justice"),
    sourceUrl: ghUrl("access-to-justice"),
    kind: "resource",
    eyebrow: "Access to Justice",
    title: "Legal-aid resources for MO-02",
    tagline: "Self-representation guides and legal-resource discovery.",
    blurb:
      "A nonpartisan navigator for legal aid in MO-02 — self-representation guides and help finding legal resources. Informational only; not legal advice.",
    relatedIssue: "family-courts",
  },
  {
    slug: "business",
    subdomain: "business",
    sourceRepo: repo("access-to-business"),
    sourceUrl: ghUrl("access-to-business"),
    kind: "resource",
    eyebrow: "Access to Business",
    title: "Small-business resources for MO-02",
    tagline: "Licensing, funding, and startup navigation for entrepreneurs.",
    blurb:
      "A nonpartisan resource navigator for MO-02 entrepreneurs — licensing, funding, and startup guidance. Informational resource navigation only.",
    relatedIssue: "lower-taxes",
  },
  {
    slug: "services",
    subdomain: "services",
    sourceRepo: repo("access-to-services"),
    sourceUrl: ghUrl("access-to-services"),
    kind: "resource",
    eyebrow: "Access to Services",
    title: "Community services for MO-02",
    tagline: "Social-determinants-of-health intake and service navigation.",
    blurb:
      "A nonpartisan hub for connecting MO-02 neighbors to community services and social supports. Informational resource navigation only.",
  },
];

export const pillarSlugs = PILLARS.map((p) => p.slug);
export const getPillar = (slug: string) => PILLARS.find((p) => p.slug === slug);

// Host label → pillar. Used by middleware (host rewrite) and by the chrome to
// detect when it is rendering on a pillar subdomain. Case-insensitive; ignores
// anything that isn't a known pillar (apex, www, localhost all return undefined).
export function pillarForHost(host: string | null | undefined): Pillar | undefined {
  if (!host) return undefined;
  const label = host.split(":")[0].split(".")[0].toLowerCase();
  return getPillar(label);
}
