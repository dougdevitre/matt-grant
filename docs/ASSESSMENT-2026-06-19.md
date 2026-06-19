# Matt Grant for Congress — Codebase Assessment & Action Plan

**Date:** 2026-06-19 · **Scope:** `web/` (Next.js 15 / React 19 SSR on AWS Amplify) + AWS architecture · **Primary:** Aug 4, 2026

This compiles the plans (strategic docs + 5 build sessions), assesses what is implemented correctly, and lays out a prioritized action plan to fix critical errors, align the AWS design to the Well-Architected Framework, and harden the app into a high-performing production system. It finishes the Well-Architected review that session `e5fbac43` started but never synthesized.

---

## 1. Where the project stands

The build is **feature-complete across essentially every planned workstream**. Cross-checked against `web/app/**` and `web/lib/**`:

| Workstream | Status |
|---|---|
| Public site (home, about, issues+detail, donate, contact, media, press, vote, act, print) | ✅ Done |
| Brand pipeline (`npm run brand`) | ✅ Code done · ⚠️ real headshot still a launch step |
| Compliance/policy pages (data-policy, transparency, public-trust) | ✅ Done |
| Donor ledger + FEC tracking + limit flags; finance; compliance calendar | ✅ Done |
| Email P1–P5 (branded shell, templates, preview, SES send, webhooks, subscribers, composer, segments) | ✅ Done |
| Email opt-out **suppression store** | ⚠️ Partial — send-guard exists, no persistent broadcast suppression list |
| 3D MO-02 field map + STL precinct turnout join | ✅ Done |
| Rural-county turnout shading (Jefferson/Washington/Crawford/Gasconade) | ❌ Data not wired (`lib/countyTurnout.ts` zeroed placeholders) |
| Precinct targets / walk lists; graphics studio; asset + photo libraries; volunteers; tasks | ✅ Done |
| Opp research — single incumbent + multi-candidate alignment engine | ✅ Done |
| Incumbent tenure timeline | ⚠️ API route landed; visualization/public surface unconfirmed |
| RBAC (admin/captain/organizer) + Clerk auth (dev, fail-closed) | ✅ Done |
| Clerk **production** instance + invite-only | ⚠️ Pending (human-owned) |
| Domain cutover (WordPress → Amplify) | ❌ Not started — **the real launch gate** |
| Print pipeline (Walgreens sandbox + library guide) | ✅ Done (prod needs Walgreens approval) |

**What's genuinely well-built (verified, no action):** server actions independently re-check capability (UI-hiding is never the only defense for mutations); all three webhooks verify signatures and fail closed; donation idempotency via `externalId`; unsubscribe token is HMAC'd with constant-time compare; the email send path refuses to ship unfilled merge tokens; DynamoDB access is Query-only (zero Scans); on-demand billing; presigned URLs for private assets; middleware fails **closed** in production when Clerk is unconfigured.

---

## 2. Critical errors — fix before anything else

### 🔴 C1 — Broken DynamoDB `UpdateExpression` corrupts every email campaign
`web/lib/campaigns.ts:262`

```js
UpdateExpression: "ADD sentCount :sd, suppressedCount :pd" + (done ? " SET #s = :sent, ..." : " SET updatedAt = :u"),
```

DynamoDB requires clause order **SET → REMOVE → ADD → DELETE**. An expression starting with `ADD` then `SET` raises `ValidationException`. The throw happens **after** emails were already sent and the cursor advanced (claim-before-send at line 219), so: recipients get mail, but `sentCount`/`suppressedCount` never increment, the campaign never flips to `sent`, and a retrying drainer can't re-claim. Dashboard shows 0 sent forever; totals are permanently wrong. **This path has no test.**

**Fix:** reorder to SET-first and add a `drainOnce` test against local DynamoDB.
```js
UpdateExpression: "SET updatedAt = :u" + (done ? ", #s = :sent, finishedAt = :u" : "") + " ADD sentCount :sd, suppressedCount :pd",
```

### 🔴 C2 — Scheduled work doesn't run on Amplify (research ingest + email drain are dead)
`web/vercel.json`, `web/app/api/cron/email-drain/route.ts`, `web/app/api/research/ingest/route.ts`

Amplify Hosting has **no native cron and ignores `vercel.json`** (the deploy doc says so). The weekly research ingest and the ~1-min email-drain both depend on an external trigger that is **not defined anywhere in IaC or the runbooks**. Net effect on a live campaign: opponent research silently goes stale, and **queued fundraising/GOTV emails never send** — "the app looks fine but nothing happens," the worst failure mode in the final weeks.

**Fix:** create two EventBridge Scheduler schedules (or one tiny Lambda that `fetch`es each route with the `CRON_SECRET` bearer), defined as code (CDK/SST — Doug already uses CDK). Delete `vercel.json`. Add a staleness alarm on the last-ingest / campaign-progress timestamp.

### 🔴 C3 — Domain never cut over (all merged work is invisible to the public)
`docs/GO-LIVE.md`, `web/docs/compliance-audit.md` (A-3)

`mattgrantforcongress.org` still serves the **old WordPress build** (`domainAssociations: []`). Every shipped compliance/site improvement is invisible until the Amplify domain mapping + DNS repoint is done. Apex can't CNAME on Namecheap → move DNS to Route 53.

**Fix:** execute the `GO-LIVE.md` runbook — associate domain in Amplify, add ACM validation records, repoint apex/`www` away from `67.223.118.124`, lower TTL before cutover.

---

## 3. AWS Well-Architected Framework — design gaps

### Security
- 🔴 **HIGH — Secrets baked into the build artifact.** `amplify.yml` writes decrypted SSM SecureStrings (`CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `WINRED_WEBHOOK_SECRET`, `UNSUB_SECRET`, …) into `.env.production` at build time. With `baseDirectory: .next` + `cache: .next/cache/**, node_modules/**`, plaintext secrets land in the artifact store and build cache. **Fix:** read SSM at *runtime* via the SSR Lambda role (no file on disk); rotate every secret that has lived in a cached build.
- 🔴 **HIGH — Build role over-privileged.** The Amplify *build* role holds `ssm:GetParameter` + `kms:Decrypt` on `/matt-grant/*` — every PR build can read prod secrets. **Fix:** move decrypt to the *runtime* role, scoped to exact parameter ARNs + the one KMS key; remove it from the build role.
- 🟠 **MEDIUM — No asserted encryption-at-rest / S3 lockdown.** Set explicit SSE-KMS on the donor table; enforce S3 Block Public Access + CloudFront OAC (public assets via CDN, bucket private).
- 🟠 **MEDIUM — SES/SNS topic ARN pin is optional** (`webhooks/ses/route.ts:30`). Make `SES_SNS_TOPIC_ARN` required in production.

### Reliability
- 🔴 **HIGH — No PITR / backups on the donor table.** `create-table.ts` creates PAY_PER_REQUEST with PK/SK only — **no PointInTimeRecovery, no backups** — for a table holding donor PII and FEC-reportable financials. One bad write is unrecoverable. **Fix (one CLI call, do before launch):** enable PITR (`continuous-backups`) + an AWS Backup plan.
- 🟠 **MEDIUM — No fetch timeouts / bounded concurrency.** External APIs (FEC, Congress.gov, Census, OpenStates, Anthropic) are fetched with no `AbortSignal`; ingest fans out with `Promise.all`, so one hung upstream rides the 300s `maxDuration` to a 502. **Fix:** `signal: AbortSignal.timeout(15000)` on every fetch + `p-limit` across the field fan-out; make ingest resumable.
- 🟠 **MEDIUM — `BatchWriteCommand` ignores `UnprocessedItems`** (`legislative/store.ts:49`, `research/store.ts:23`) → silent data loss under throttle. Loop on unprocessed with backoff.

### Operational Excellence
- 🔴 **HIGH — No observability.** Zero CloudWatch alarms, no custom metrics, no structured logging, no DLQs. When donations stop recording or emails stop sending, nobody is paged. **Fix:** alarms on SSR Lambda errors, a synthetic canary on `/` + `/donate`, a metric on webhook 4xx/5xx → SNS email.
- 🟠 **MEDIUM — Click-ops, not IaC.** Table, IAM, SSM, SNS/SES, scheduler all created by hand via console/CloudShell snippets. **Fix:** move to CDK/SST (Option B is already documented in `DEPLOY-AWS.md`).
- 🟠 **MEDIUM — `.env.production` materialization is silent-failing** (`|| true`); a renamed key no-ops at runtime with no signal. Fail the build if a *required* key is missing.
- 🟢 **LOW — `eslint.ignoreDuringBuilds: true`** — add lint/typecheck to the build phase.

### Performance Efficiency
- 🟠 **MEDIUM — DynamoDB client not reused in prod.** `db.ts:11` caches the DocumentClient on `globalThis` only when `NODE_ENV !== "production"` — backwards for serverless; prod builds a fresh client per cold module-eval. **Fix:** cache on `globalThis` in all environments (Lambda reuses module scope across warm invocations).
- 🟢 **LOW — No ISR/static on public pages.** Mark `/`, `/donate`, `/about` static/ISR so CloudFront serves them instead of invoking the SSR Lambda.

### Cost Optimization
- 🟠 **MEDIUM — No CloudWatch log retention** → Amplify/Lambda logs never expire. Set 30–90 day retention.
- 🟢 **LOW — Cache S3 listings.** `s3.ts` re-lists and re-presigns every object on each dashboard load.
- 🟢 On-demand DynamoDB billing is the right call for spiky campaign traffic — keep.

### Sustainability
- 🟢 Serverless-everywhere (Amplify SSR Lambda, DynamoDB on-demand, S3) scales to zero — good posture. us-east-1 is fine given SES prod access + existing footprint.

---

## 4. Correctness & consistency (code-level)

### HIGH
- **H1 — Broken access control.** `app/dashboard/research/page.tsx` and `app/dashboard/plan/page.tsx` enforce nothing; the RBAC matrix denies `organizer` `viewResearch`/`viewPlan` but only the sidebar hides the links. An organizer typing `/dashboard/research` sees opponent FEC finances. **Fix:** add `const { role } = await staffGate(); if (!can(role, "viewResearch")) redirect(...)` to both pages, matching the finance/donors/compliance pattern.
- **H2 — Non-constant-time secret compare** in `research/ingest/route.ts:17` (`=== \`Bearer ${secret}\``). The sibling `email-drain` route uses `crypto.timingSafeEqual` — mirror it.
- **H3 — No HTTP timeouts** on integration clients (FEC, Congress, Census, OpenStates) — see Reliability above.
- **H4 — No 429/Retry-After handling** on FEC/Congress; `getDonorProfile` fires 4 concurrent Schedule-A calls × all candidates unbounded → instant 429 on `DEMO_KEY`. Add backoff honoring `Retry-After` + concurrency cap.
- **H5 — Public `print/*` routes reflect upstream Walgreens JSON verbatim** and the order route has no idempotency/rate limit → duplicate real orders once `WALGREENS_ENV=production`. Whitelist returned fields; add an idempotency token + rate limit.
- **H6 — `BatchWrite` `UnprocessedItems` ignored** (also Reliability).

### MEDIUM (selected)
- **M2 — `bachelorsPlusPct` undercounts** — maps only `B15003_022E` (bachelor's exactly); add `_023E.._025E` for "or higher."
- **M3 — Clerk-vote fetch conflates 5xx/network with "no vote"** (`clerkVotes.ts`) → silently under-counts the voting record.
- **M5 — `assets/upload`** has no size/MIME cap and buffers whole file in memory; sanitize the S3 key.
- **M6 — `press/topics`** concatenates untrusted `outlet`/`focus` into an Anthropic prompt with no delimiting; wrap as data, label AI output unverified.
- **M8 — `runFieldIngest` records `ok: true` even when every candidate failed** → monitoring shows green on total failure.

### LOW
- Raw `String(err)` leaked to authenticated callers (several routes); inconsistent error envelopes (`{error}` vs `{ok:false,error}` vs text vs reflected JSON) — standardize; vote sort-key padding width-4 breaks ≥10000; wrong congress-ordinal URLs (`101th`) produce dead verify links.

### Test gaps that would have caught real bugs
No coverage for `drainOnce`/campaign send (would have caught C1), `recordContribution` dedupe, `staffGate` role resolution, webhook normalizers, or any integration client. Strong coverage exists for RBAC matrix, unsubscribe token, and CHILD-Act scoring.

---

## 5. Outstanding (human / non-code) items

- **Clerk production** instance, invite-only sign-up, prod keys, dev-key rotation.
- **Real headshot** at `web/public/brand/matt-grant-source.png` + `npm run brand`.
- **Rural-county turnout** — hand-entered, sourced numbers (MO SOS has no machine-readable feed).
- **Email suppression store** for broadcast sends.
- **Legal/compliance:** video caption `.vtt` files (WCAG 1.2.2), image/music licensing, "I approve this message" if video runs as paid ads, TCPA written-consent quality, WinRed recurring-default check, manual (non-axe) a11y pass.
- **Walgreens production** app approval + prod creds.
- **Process hazard:** concurrent sessions on one checkout caused branch-flap — keep one session per checkout.

---

## 6. Recommended execution order

1. **C1** — fix the `UpdateExpression` (one-line) + add a `drainOnce` test. *Corrupts every send.*
2. **DynamoDB PITR + backup** — one CLI call, prevents irrecoverable FEC-record loss.
3. **C2** — EventBridge Scheduler for ingest + email-drain; delete `vercel.json`. *Without it, nothing runs.*
4. **Security HIGH** — stop baking secrets into `.next`; read SSM at runtime; scope IAM to the runtime role; rotate exposed secrets.
5. **H1** — gate the research/plan dashboard pages.
6. **Observability** — alarms + canary + webhook failure metric so silent failures page someone.
7. **H2–H6 / integration hardening** — timeouts, backoff, `UnprocessedItems`, print route lockdown.
8. **C3 + go-live** — domain cutover, Clerk prod, real headshot, legal items.
9. **Perf/cost cleanup** — DDB client reuse, log retention, ISR on public pages.

The architecture is sound; the gaps are **operational** (scheduling, observability, backups, secret handling) and a few real correctness bugs — not structural. C1, C2, PITR, and the secret-handling fix are the four that matter most before this carries live donor data and fundraising email.
