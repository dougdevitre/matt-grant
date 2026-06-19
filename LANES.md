# LANES.md — Parallel Build Ownership Contract

This file is the **single source of truth** for who owns what when multiple Claude Code
sessions build this app in parallel. It exists to prevent the failure mode we have hit
before: two sessions editing the same file, branch-flap on a shared checkout, and GitHub
"Update branch" silently dropping one side of adjacent insertions in shared registries.

**If you are a session working a lane: read your lane's "Owns" list. Edit only those paths.
If you need to change a file you do not own, open a request to the owning lane — do not edit it.**

---

## The three rules

1. **One worktree per lane. Never share a checkout.** Use `scripts/setup-worktrees.sh`.
   Each lane = its own directory (`../mg-lane-NN`), its own branch (`lane/NN-name`), its own PR.
2. **Disjoint ownership.** Every path below has exactly one owner. No overlaps.
3. **Shared registries are single-owner (Lane 1 / Lane 3).** Never let two lanes append to the
   same registry line. The registries are listed in "Insertion-point registries" below.

---

## Sequencing

- **Wave 0 (serial, land first):** Lane 1 (Foundation/Design) + Lane 3 (Security/RBAC).
  These define the contracts everyone consumes. Merge them to `main` before fan-out.
- **Wave 1 (parallel):** Lanes 2, 4, 5, 6, 7, 8, 9, 10 branch off the merged `main`.
- Lanes 2 (infra) and 10 (QA) are physically disjoint from app code and may run the whole time.

Each lane writes its **own** unit tests as siblings in its own directory. Lane 10 owns only
E2E / CI / a11y — it never edits another lane's source.

---

## Lanes

### Lane 1 — Foundation & Design System  *(Wave 0)*
**Goal:** consistent, improving UX — the single source of design tokens + shared contracts.
**Owns:**
- `web/tailwind.config.ts`, `web/app/layout.tsx`, `web/app/error.tsx`, `web/app/not-found.tsx`
- `web/app/(site)/layout.tsx`, `web/app/dashboard/layout.tsx`, `web/app/dashboard/loading.tsx`
- `web/components/ui/**`, `web/components/dashboard/DashSidebar.tsx`, `web/components/dashboard/DashIcon.tsx`
- `web/lib/db.ts` (the `PK` key registry), `web/lib/site.ts`, `web/lib/og.tsx`, `web/lib/queries.ts`, `web/lib/actions.ts`
- `web/lib/contracts/**`, new `web/lib/theme.ts`
- `web/app/{manifest,robots,sitemap,opengraph-image,twitter-image}.*`
- `LANES.md`
**Assessment tasks:** DDB client `globalThis` reuse in prod (`db.ts`); standardize API error envelope (`lib/contracts/api.ts`).

### Lane 2 — Infra / IaC / Observability
**Goal:** secure & private operations; the app actually runs.
**Owns:** new `infra/**` (CDK), `amplify.yml`, `docs/DEPLOY-AWS.md`, `docs/RUNBOOK.md`, `web/next.config.mjs`; **delete** `web/vercel.json`.
**Assessment tasks:** C2 EventBridge scheduler (ingest + email-drain); DynamoDB PITR + AWS Backup; secrets out of `.next` artifact, scoped IAM to runtime role, rotate; CloudWatch alarms + synthetic canary; log retention.

### Lane 3 — Security / RBAC / Auth  *(Wave 0)*
**Goal:** secure & private experience.
**Owns:** `web/middleware.ts`, `web/lib/auth.ts`, `web/lib/rbac.ts` (+test), `web/lib/clerkRoles.ts`, `web/lib/staff.ts`, `web/lib/audit.ts`, `web/app/api/webhooks/clerk/**`, `web/app/dashboard/team/**`.
**Provides:** `requireCap(cap)` helper that feature lanes call to gate pages (fixes H1 across lanes).
**Assessment tasks:** RBAC matrix; webhook hardening.

### Lane 4 — Email & Campaigns
**Goal:** take action / get involved (engagement sends).
**Owns:** `web/lib/email/**`, `web/lib/campaigns.ts`, `web/lib/campaignSend.ts`, `web/lib/subscribers.ts` (+test), `web/lib/sns.ts`, `web/app/dashboard/emails/**`, `web/app/dashboard/subscribers/**`, `web/app/(site)/unsubscribe/**`, `web/app/api/unsubscribe/**`, `web/app/api/cron/email-drain/**`, `web/app/api/email/preview/**`, `web/app/api/webhooks/{ses,winred}/**`.
**Assessment tasks:** **C1 — fix `campaigns.ts:262` UpdateExpression order + add `drainOnce` test**; persistent broadcast suppression store.

### Lane 5 — Campaign Ops & Compliance
**Goal:** secure & private donor data.
**Owns:** `web/lib/donors.ts`, `web/lib/money.ts`, `web/app/dashboard/{donors,finance,compliance,volunteers,tasks,plan}/**`.
**Assessment tasks:** H1 plan-page gate (apply `requireCap("viewPlan")`); `recordContribution` dedupe test; `addDonor` → shared `recordContribution` DRY.

### Lane 6 — Research / Oppo / Data Integrations
**Goal:** create content (research → message).
**Owns:** `web/app/dashboard/research/**`, `web/app/api/research/**`, `web/app/api/press/topics/**`, `web/lib/analysis/**`, `web/lib/pressTopics.ts`, `web/lib/integrations/{fec,legislative,census,openstates,research,statements}/**`.
**Assessment tasks:** H1 research-page gate; H2 timing-safe ingest secret; H3 fetch timeouts; H4 429/backoff + concurrency cap; H6 `UnprocessedItems`; M2 bachelors-plus; M3 vote-fetch error handling; M8 ingest `ok` flag.

### Lane 7 — Map / GIS / Targeting
**Goal:** take action (field plan / walk lists).
**Owns:** `web/app/dashboard/{map,targets}/**`, `web/app/api/geo/**`, `web/lib/{mapData,geoSources,precincts,countyTurnout,countySources}.ts`.
**Assessment tasks:** wire rural-county turnout shading (sourced data).

### Lane 8 — Public Site & Take Action
**Goal:** get involved / take action.
**Owns:** `web/app/(site)/{page.tsx,about,issues,act,vote,media,press,contact,donate,public-trust,transparency,data-policy}/**`, `web/lib/issues.ts`, public engagement components (AgendaBuilder, AskMatt, share/get-involved).
**Assessment tasks:** ISR/static on public marketing pages (perf/cost).

### Lane 9 — Content Creation Studio
**Goal:** ability to create their own content.
**Owns:** `web/app/dashboard/{studio,assets,photos}/**`, `web/app/api/{graphics,assets,print}/**`, `web/app/(site)/print/**`, `web/lib/{socialPosts,walgreens,s3,webPhotos}.ts`, `web/lib/assets.manifest.json`.
**Assessment tasks:** H5 print-route idempotency + response field whitelist; M5 upload size/MIME validation + key sanitize.

### Lane 10 — QA / CI / a11y / E2E
**Goal:** build & test faster; consistent UX.
**Owns:** new `web/e2e/**` (Playwright), `.github/workflows/**`, `web/vitest.config.ts`, axe a11y harness, visual-regression baselines.
**Rule:** never edit another lane's source — add E2E/CI only; file unit-test gaps as requests to the owning lane.

---

## Insertion-point registries (single-owner — do not append from other lanes)

These are the files that cause silent merge drops when multiple lanes touch them. Each has ONE owner.
A lane needing an entry here opens a one-line request to the owner.

| Registry | File | Owner |
|---|---|---|
| Partition keys | `web/lib/db.ts` → `PK` | Lane 1 |
| Capabilities + matrix | `web/lib/rbac.ts` → `Capability`, `MATRIX` | Lane 3 |
| Dashboard nav | `web/components/dashboard/DashSidebar.tsx` → `ITEMS` | Lane 1 |
| Design tokens | `web/tailwind.config.ts`, `web/lib/theme.ts` | Lane 1 |
| Root/section layouts | `web/app/**/layout.tsx` | Lane 1 |
| API error envelope | `web/lib/contracts/api.ts` | Lane 1 |

To reduce requests: **Lane 1 pre-declares every planned route/key, and Lane 3 pre-declares every
planned capability, during Wave 0** — so feature lanes consume stable contracts and rarely need a change.

---

## Merge discipline

- One small PR per lane, merged often. Keep PRs focused on the lane's owned paths.
- **Rebase onto `main` manually** before merge. Do NOT use GitHub "Update branch" on stacked work —
  it drops adjacent insertions in shared registries (we have been burned by this).
- Merge order when several are ready: **1 → 3 → 2 → feature lanes → 10**.
- After every merge to `main`, all open lanes `git rebase main`. Because ownership is disjoint,
  conflicts only appear in Lane 1/Lane 3 registries — which only those lanes edit.
- Before every push: `npm run lint && npm run build` from `web/` (root `tsc` is laxer than Next's build).
