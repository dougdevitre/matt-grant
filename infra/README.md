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

1. **Secrets out of the build artifact.** ✅ **DONE** (see `SECRETS-MIGRATION.md`).
   The four app-readable secrets (`CRON_SECRET`, `ANTHROPIC_API_KEY`,
   `WINRED_WEBHOOK_SECRET`, `UNSUB_SECRET`) now load at runtime from SSM via
   `web/lib/ssm.ts` `getSecret()` on the compute role and are no longer baked into
   `.env.production`. Remaining: **rotate** the secrets that lived in a cached build.
   (`CLERK_SECRET_KEY`/`CLERK_WEBHOOK_SIGNING_SECRET` stay baked — the Clerk SDK
   reads env directly.)
2. **Scope IAM.** ✅ **DONE / N/A.** Runtime read is scoped to the compute role
   (step 6: `ssm:GetParameter` on `/matt-grant/*` + `kms:Decrypt` via SSM only).
   The app has **no build/service role** (`iamServiceRoleArn` is null), so there is
   no build-role grant to remove.
3. **AWS Backup plan** (belt-and-suspenders beyond PITR) — ✅ **scripted** in
   `setup-aws.sh` step 7: a `matt-grant-backup-role`, a `matt-grant-backup` vault,
   a daily 35-day plan (`matt-grant-daily`), and a selection of the DynamoDB table.
   PITR alone dies with the table; these snapshots live in a separate vault.
4. **S3 / encryption** — ✅ **scripted** in `setup-aws.sh` step 8: enforces Block
   Public Access (all four) + default bucket encryption on the assets bucket, and
   **audits** the judgment calls — reports whether the bucket policy is public and
   whether it follows the CloudFront-OAC pattern (no live distribution/policy is
   mutated). Step 8d reports the DynamoDB SSE type and, with `SET_TABLE_KMS=1`,
   upgrades the table to an AWS-managed KMS key so key usage is auditable in
   CloudTrail (recommended for donor PII).

## Verifying the schedules fire

```bash
# manual drain (same call the scheduler makes)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://mattgrantforcongress.org/api/cron/email-drain
# then watch the schedule's last-invocation in the EventBridge Scheduler console
```
