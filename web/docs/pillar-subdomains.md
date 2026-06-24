# Pillar subdomains

Each `dougdevitre/access-to-*` pillar is published as a nonpartisan resource hub on
its own subdomain of `mattgrantforcongress.org` (e.g.
`education.mattgrantforcongress.org`), served by **this same Next.js app** so every
hub shares Matt Grant's header, footer, CTAs, and design tokens. There is one
codebase and one deploy — no per-pillar repos or sites.

## How it works

```
education.mattgrantforcongress.org/iep-guide
        │  host rewrite (middleware.ts → lib/pillar-routing.ts)
        ▼
/pillars/education/iep-guide   ← under app/(site), inherits SiteHeader/Footer/AskMatt
        ▲
lib/pillars.ts (catalog)  +  content/pillars/education/** (synced, committed)
```

- **Catalog:** `lib/pillars.ts` — one entry per pillar (slug, subdomain, source repo,
  blurb, optional `relatedIssue`). Single source of truth; the middleware and the
  sync script both read it.
- **Routing:** `middleware.ts` calls `pillarRewritePath(host, pathname)`
  (`lib/pillar-routing.ts`). A known pillar label on `*.mattgrantforcongress.org`
  rewrites to `/pillars/<slug>/…`. Apex, `www`, `localhost`, `/api/*`, and existing
  `/pillars/*` paths pass through.
- **Pages:** `app/(site)/pillars/[pillar]/page.tsx` (hub),
  `[...slug]/page.tsx` (synced markdown article),
  `tools/[tool]/page.tsx` (chrome-wrapped iframe of a synced HTML tool).
- **Chrome on subdomains:** `SiteHeader` (client) detects the subdomain via
  `useOnSubdomain()` and absolutizes main-site nav to the apex with `mainHref()`;
  `SiteFooter` (server) always links absolute to the apex. Prevents `/about`-style
  links from 404-ing on a subdomain.
- **Content:** `scripts/sync-pillars.mjs` clones each repo and writes
  `content/pillars/<slug>/*.md` + `public/pillar-tools/<slug>/*.html` +
  `manifest.json`. Output is committed; the build does no network I/O.

## Framing guardrail

Resource hubs are **nonpartisan constituent resources, not campaign policy
positions** (only the four priorities in `lib/issues.ts` state positions). Every hub
and article carries the disclaimer and the `Paid for by` line. Have campaign
counsel sign off on committee-hosted resource subdomains before launch.

## DNS + Amplify (ops, post-merge)

1. In the Amplify app → **Domain management**, add the subdomains pointing at this
   same app. Use a wildcard `*.mattgrantforcongress.org` if supported (covers the 8
   resource hubs AND the 4 vanity issue subdomains at once); otherwise add each of
   `education`, `jobs`, `housing`, `food`, `health`, `justice`, `business`,
   `services`, `courts`, `limits`, `lean`, `taxes` explicitly.
2. Manage the records in **Route 53** (the apex is moving there per `docs/GO-LIVE.md`).
3. Verify TLS is issued for each subdomain, then load
   `https://education.mattgrantforcongress.org` and confirm the shared chrome renders.

## Vanity issue subdomains

Short marketing aliases for the four documented priorities **308-redirect** to the
canonical `/issues/<slug>` page on the apex (no duplicate content). Defined in
`ISSUE_VANITY` (`lib/pillar-routing.ts`); the redirect is issued by `middleware.ts`
before the pillar rewrite. Labels are distinct from the resource-pillar labels
(`justice.` stays the legal-aid hub).

| Subdomain | Redirects to |
|---|---|
| `courts.mattgrantforcongress.org` | `/issues/family-courts` |
| `limits.mattgrantforcongress.org` | `/issues/term-limits` |
| `lean.mattgrantforcongress.org` | `/issues/smaller-government` |
| `taxes.mattgrantforcongress.org` | `/issues/lower-taxes` |

These need the same DNS step below (a wildcard `*.mattgrantforcongress.org` covers
them). They are redirects, so they are intentionally absent from `sitemap.ts`. To
change a label, edit the `ISSUE_VANITY` map (the unit test enforces that every value
is a real issue slug and never collides with a resource-pillar label).

## Add or refresh a pillar

1. Add/adjust the entry in `lib/pillars.ts`.
2. `npm run sync:pillars -- --only <slug>` and commit the generated files.
3. Add the subdomain in Amplify/Route 53. No further code changes per pillar.
