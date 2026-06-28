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

> Copy-pasteable step-by-step: **`docs/pillar-dns-checklist.md`**. Content auto-refresh
> in CI: the **`sync-pillars`** GitHub Action (`.github/workflows/sync-pillars.yml`).


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

## Reserved subdomains (first-party app sections)

Some subdomains are neither resource pillars nor vanity redirects — they host a
first-party section of **this same app** on their own subdomain, via an internal
**rewrite** (the address bar stays on the subdomain). Defined in `RESERVED_SUBDOMAINS`
(`lib/pillar-routing.ts`); the rewrite is issued by `middleware.ts` (`reservedRewrite`)
before the pillar rewrite. `unknownPillarSubdomain()` treats these labels as *known*,
so they don't log a drift warning.

| Subdomain | Rewrites to | What it is |
|---|---|---|
| `games.mattgrantforcongress.org` | `/games` | Four Fights arcade — one civic mini-game per priority (see `docs/games.md`). |

The underlying route (`app/games/**`) is reachable on the apex too (`/games`), so
in-app links from the issue pages use the internal `/games/...` path; the subdomain is
a marketing alias for the same content. Wildcard `*.mattgrantforcongress.org` covers
the DNS.

## Add or refresh a pillar

1. Add/adjust the entry in `lib/pillars.ts`.
2. `npm run sync:pillars -- --only <slug>` and commit the generated files.
3. Add the subdomain in Amplify/Route 53. No further code changes per pillar.

## Hidden hubs

A pillar can carry `hidden: true` in `lib/pillars.ts`. It stays in the catalog (so the
sync still tracks its repo and the host router treats its subdomain as *known* — a 404,
not an unknown-subdomain warning), but it is dropped from every public surface (sitemap,
static generation, OG cards, cross-links) and its hub/articles 404. `publicPillars` /
`publicPillarSlugs` are the visible subset; `pillarSlugs` / `getPillar` stay all-inclusive.
The contract is locked by `lib/pillars.test.ts`.

Currently hidden, with the reason and the un-hide condition:

| Hub | Why hidden | Un-hide when |
|---|---|---|
| `food` | Source repo imported **0 docs** (empty). | The `access-to-food` repo has real content and a sync imports it. |
| `justice` | Source repo imported **0 docs** (empty). | The `access-to-justice` repo has real content and a sync imports it. |
| `health` | Imported content is a public-health **advocacy/policy toolkit** — explicit positions on guns, abortion, climate, immigration, and race (`apha-knowledgebase.md`, `apha-url-index.md`, `fiscal-crisis-brief.md`, …). Off-mission for a nonpartisan constituent hub on the candidate's domain. | **`access-to-health` is reworked** into neutral, constituent-facing resources (no advocacy positions), reviewed against the framing guardrail above. |

> **Repo-rework flag:** `access-to-health` needs to be repointed/rewritten toward neutral
> MO-02 constituent health-resource navigation (where to find clinics, public-health
> programs, Missouri-specific services) before its hub goes public. Hiding is visibility
> only — the 9 committed docs stay tracked-but-unserved until then.

## Stability guardrails

These keep the hardened paths from failing silently. Most are enforced in code; one
is a repo setting you must enable.

- **Sync fails loudly.** `scripts/sync-pillars.mjs` exits non-zero if any pillar fails
  to clone or trips the regression guard (had docs upstream, now imports zero), so the
  `sync-pillars` workflow stops before committing a partial/destroyed result. It also
  prunes files that disappear upstream and writes a per-pillar summary to the run page.
- **Routing + content invariants are tested.** `lib/pillar-middleware.test.ts`,
  `lib/pillar-routing.test.ts`, `lib/pillar-dns-drift.test.ts` (vanity table ↔
  `ISSUE_VANITY`), and `lib/pillars-content.test.ts` (every committed `manifest.json`
  is valid and its referenced files exist) all run in `ci.yml`.
- **Make CI a required check (manual, needs repo admin — do this once).** `ci.yml`
  already runs lint + typecheck + tests + a keyless build, plus an "up-to-date with
  base" guard, on every PR — but GitHub won't *block* a merge until those are marked
  required. In **Settings → Branches → branch protection for `main`**, enable
  *"Require status checks to pass"* and select **`build-test`** and **`up-to-date`**,
  and check *"Require branches to be up to date before merging."* Without this, a red
  CI run can still be merged.
