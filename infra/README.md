# infra/ — operational AWS setup

Amplify Hosting deploys the app, but several production-critical pieces are NOT
part of an Amplify deploy. This directory codifies them so they are reproducible
and reviewable instead of living as console click-ops. From the assessment
(`docs/ASSESSMENT-2026-06-19.md`), these are the operational gaps.

## `setup-aws.sh`

Idempotent AWS CLI script. **Review before running** — it was authored without
access to the live account; confirm names/ARNs match your environment.

```bash
CRON_SECRET=... BASE_URL=https://mattgrantforcongress.org \
ALERT_EMAIL=you@example.com bash infra/setup-aws.sh
```

It provisions:

| # | Fix | Pillar | Why |
|---|---|---|---|
| 1 | DynamoDB **PITR** on `matt-grant` | Reliability | Donor/FEC data had no backups; a bad write was unrecoverable. PITR gives 35-day point-in-time restore. |
| 2 | CloudWatch **log retention** (90d) | Cost | Amplify/Lambda logs defaulted to never-expire. |
| 3 | **Scheduled jobs** for `/api/research/ingest` (weekly) and `/api/cron/email-drain` (1-min) | Reliability | Amplify has no native cron and ignores `vercel.json` (now deleted) — these never fired, so research went stale and **queued email never sent**. Wired via EventBridge Scheduler → API destination, bearer secret held in an EventBridge Connection. |
| 4 | **Lambda-errors alarm → SNS email** | Ops Excellence | Donations/emails could fail silently with nobody paged. |

## Still requires human action (cannot be scripted safely here)

These are flagged HIGH in the assessment and need decisions/credentials:

1. **Secrets out of the build artifact.** `amplify.yml` writes decrypted SSM
   SecureStrings into `.env.production` at build time; with `.next` + build cache
   as artifacts, plaintext secrets can land in the artifact store/cache. Move to
   **runtime SSM reads** via the SSR Lambda role (a small `lib/ssm.ts` cached
   loader — owned by a follow-up), then **rotate** every secret that has lived in
   a cached build: `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`,
   `WINRED_WEBHOOK_SECRET`, `CLERK_WEBHOOK_SIGNING_SECRET`, `UNSUB_SECRET`.
2. **Scope IAM.** Remove `kms:Decrypt` + `ssm:GetParameter` from the Amplify
   **build** role; grant them on the specific parameter ARNs to the **runtime**
   SSR role only.
3. **AWS Backup plan** (belt-and-suspenders beyond PITR) — add a daily plan +
   selection for the table once a backup service role exists.
4. **S3 / encryption** — confirm the assets bucket has Block Public Access ON +
   CloudFront OAC, and set explicit SSE-KMS on the table if required for PII.

## Verifying the schedules fire

```bash
# manual drain (same call the scheduler makes)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://mattgrantforcongress.org/api/cron/email-drain
# then watch the schedule's last-invocation in the EventBridge Scheduler console
```
