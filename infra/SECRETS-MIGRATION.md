# Secrets migration — out of the build artifact, into runtime SSM

Closes the HIGH finding: `amplify.yml` writes decrypted SSM SecureStrings into
`.env.production` at build time, and with `.next` + build cache as artifacts those
plaintext secrets can land in the artifact store / cache.

The code foundation is shipped: **`web/lib/ssm.ts` → `getSecret(name)`**, an
**env-first** runtime loader. While secrets are still baked, `getSecret` returns
the `process.env` value and never calls SSM — so each step below is independently
deployable and reversible, with **no gap** where a secret is unavailable.

## Inventory (verified against the account 2026-06-19)

Cross-referenced: every `process.env.*` the app reads vs `/matt-grant/*` in SSM vs
the Amplify app's environment variables.

### A. Secrets in SSM — what can actually move to `getSecret`

Key constraint: the Clerk SDK and the client build read some secrets from env
**directly**, so those can never move to a runtime loader — they stay in env
(baked or Amplify env) regardless. The migration therefore REDUCES the baked
secret footprint; it cannot zero it.

**A1 — wireable (the app's own code reads them):**

- `CRON_SECRET` — ✅ wired (cron + ingest auth)
- `ANTHROPIC_API_KEY` — ✅ wired (press/topics)
- `FEC_API_KEY`, `CONGRESS_GOV_API_KEY`, `OPENSTATES_API_KEY`, `CENSUS_API_KEY`,
  `WALGREENS_API_KEY`/`AFF_ID` — wireable, but each has a module-scope `enabled`
  flag (`export const fecEnabled = !!process.env…`) that must be refactored to
  resolve async. Low security value (free public-data keys) → deferred.
- `UNSUB_SECRET` — ✅ wired. The unsubscribe token chain in `lib/subscribers.ts`
  (`sign`/`unsubToken`/`unsubscribeUrl`/`unsubscribeApiUrl`/`verifyUnsubToken`) is
  now async and resolves the key via `getSecret("UNSUB_SECRET")` → `CRON_SECRET` →
  dev default. All callers (`campaignSend.ts`, the `/unsubscribe` page/action, and
  `/api/unsubscribe`) `await` it. env-first → no behavior change until un-baked.
  (Create `/matt-grant/UNSUB_SECRET` in SSM before step 3 — section B.)
- `WINRED_WEBHOOK_SECRET` — ✅ wired (`/api/webhooks/winred` reads via getSecret).
  Create in SSM before step 3 (section B).

**Step 2 is complete: every wireable app secret now reads through `getSecret`.** The
remaining work is AWS-operational (steps 1, 3, 4 + section B) and needs account
access — none of it changes app code.

**A2 — CANNOT move (read by the SDK / build, not our code):**

- `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET` — `@clerk/*` (incl.
  `verifyWebhook`) reads these from env. They MUST stay in env.
- `NEXT_PUBLIC_*` — inlined into the client bundle at build time.

So step 3 (un-baking) can drop the A1 secrets from the artifact, but the Clerk
secrets remain.

### B. Secrets the app reads but that are NOT in SSM — CREATE before un-baking (step 3)

Otherwise `getSecret` returns `undefined` once the env var stops being baked.

- **`WINRED_WEBHOOK_SECRET`** — set *nowhere* today (not SSM, not Amplify env), so
  the WinRed webhook is fail-closed (401) and won't record donations once WinRed
  posts to it. Generate a value, store at `/matt-grant/WINRED_WEBHOOK_SECRET`, and
  set the **same** value in WinRed's webhook config.
- **`UNSUB_SECRET`** — set nowhere; currently falls back to `CRON_SECRET`
  (`subscribers.ts`). Create `/matt-grant/UNSUB_SECRET` with its own value so
  rotating `CRON_SECRET` can't invalidate outstanding unsubscribe links.
- **`WALGREENS_PUBLISHER_ID`** — optional (affiliate attribution on print orders);
  create only if you use it.

### C. Non-secret config — LEAVE as Amplify env / SSM String (do NOT move to getSecret)

`DASHBOARD_ALLOWLIST` (SSM String), `NEXT_PUBLIC_*`, `S3_ASSETS_BUCKET`, `SES_FROM`,
`WALGREENS_ENV`, `ASSETS_CDN_URL`, `SES_CONFIG_SET`, `SES_SNS_TOPIC_ARN`,
`ANTHROPIC_MODEL`, `RESEARCH_*`, `CENSUS_ACS_YEAR`, `CENSUS_MO02_COUNTIES`,
`ALLOW_OPEN_DASHBOARD`, `DYNAMODB_TABLE`, `AWS_REGION`. These aren't sensitive;
keep them in env so step 3 only removes *secret* names from the bake loop.

> Note: `SES_SNS_TOPIC_ARN` is in Amplify env but not SSM — fine, it's config. The
> assessment recommends making it required in prod so the SES webhook pins its topic.

## Order of operations (do not reorder — step 4 is last)

1. **Grant the runtime role SSM read.** Give the Amplify **SSR compute** role (not
   the build role) `ssm:GetParameter` on the exact `arn:aws:ssm:…:parameter/matt-grant/*`
   ARNs + `kms:Decrypt` scoped to SSM (`kms:ViaService`). Leave the build role's
   SSM/KMS in place for now. **Automated:** `infra/setup-aws.sh` step 6 attaches
   the inline policy `matt-grant-ssm-runtime-read` to the app's compute role (and
   tells you how to create one if the app has none yet).
2. **Wire call sites to `getSecret`.** ✅ **DONE.** All secrets the app's own code
   reads now resolve via `await getSecret("X")` in their (async) handlers:
   `CRON_SECRET`, `ANTHROPIC_API_KEY`, `WINRED_WEBHOOK_SECRET`, and `UNSUB_SECRET`
   (the last via the now-async unsubscribe token chain). `CLERK_*` stay in env (A2);
   the free public-data API keys are deferred (A1). Because env still wins, this
   deployed with zero behavior change.
3. **Stop baking the secrets.** ✅ **APPLIED in code.** `amplify.yml` no longer
   materializes `CRON_SECRET`, `ANTHROPIC_API_KEY`, `WINRED_WEBHOOK_SECRET`, or
   `UNSUB_SECRET` into `.env.production` (removed from both the env-materialize and
   the SSM-pull loops). Non-secret config (`DYNAMODB_TABLE`, `AWS_REGION`,
   `NEXT_PUBLIC_*`, `ANTHROPIC_MODEL`, public-data API keys) and the Clerk secrets
   stay baked. **DEPLOY GATE:** this only takes effect on deploy, and only works if
   step 1 (runtime-role SSM read) is in place and all four params exist in SSM —
   confirm both before merging to `main`. After deploy, verify webhooks/cron still
   authenticate and the press-topics LLM call still works, then confirm the four
   secrets are absent from the deployed env.
4. **Rotate + scope the build role.** Any secret that ever lived in a baked/cached
   build is considered exposed — regenerate it in its console (Clerk, Anthropic,
   WinRed, and the app-generated `CRON_SECRET`/`UNSUB_SECRET`) and update the SSM
   parameter. Then **scope** the build role's SSM/KMS: the build still needs
   `ssm:GetParameter` for the **9 params its preBuild pull loop reads**
   (`DASHBOARD_ALLOWLIST`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ANTHROPIC_MODEL`,
   `CONGRESS_GOV_API_KEY`, `FEC_API_KEY`, `OPENSTATES_API_KEY`, `CENSUS_API_KEY`,
   `GAMES_LEAD_BASE_ID`, `GAMES_LEAD_TABLE_ID`) — but it should **not** hold a
   wildcard on `/matt-grant/*`, which today re-grants the build read access to the
   four runtime-only secrets (`CRON_SECRET`, `ANTHROPIC_API_KEY`,
   `WINRED_WEBHOOK_SECRET`, `UNSUB_SECRET`) that step 3 deliberately kept out of the
   artifact. A compromised dependency during `npm ci` could otherwise exfiltrate
   them. Replace the wildcard grant with the least-privilege inline policy in
   **`infra/build-role-policy.json`** (fill in `ACCOUNT_ID` / `KMS_KEY_ARN`). Keep
   this list in sync with the pull loop in `amplify.yml` if either changes.

## Why env-first matters

Each step is a no-op until the next: wiring (step 2) changes nothing while baking
is on; un-baking (step 3) only takes effect because the loader is already wired.
If anything misbehaves, re-add the secret to `amplify.yml` and redeploy — env wins
again instantly.

## Validation per step

- After step 2: webhooks (WinRed/SES/Clerk) and `/api/cron/email-drain` still
  return their normal responses; press-topics LLM call still works.
- After step 3: same checks, plus confirm the secrets are **absent** from the
  deployed env (e.g. a temporary debug route or Amplify env inspection) and that
  CloudWatch shows the SSM `GetParameter` calls.
