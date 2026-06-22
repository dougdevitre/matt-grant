# Deploy on AWS (instead of Vercel)

The app is a standard Next.js 15 App-Router app, and its database is **AWS DynamoDB** (a single
on-demand table) — so it's fully AWS-native with no servers or connection pooling. You already pay
for AWS, so this avoids Vercel hosting + DB cost. Three hosting options, simplest first.

## Option A — AWS Amplify Hosting (recommended)

Managed Next.js SSR on AWS (Lambda + CloudFront under the hood). Closest to the Vercel experience.

1. **Amplify console** → <https://console.aws.amazon.com/amplify> → **New app → Host web app** → connect
   GitHub → pick `dougdevitre/matt-grant`.
2. Amplify reads `amplify.yml` (appRoot `web`). Confirm the build; it runs `next build`.
3. **Environment variables** (App settings → Environment variables): `DYNAMODB_TABLE`, `AWS_REGION`,
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CONGRESS_GOV_API_KEY`, `CRON_SECRET`,
   `RESEARCH_*`. Pull them from SSM `/matt-grant/*` (your source of truth).
4. **IAM** — give the Amplify SSR compute role DynamoDB access on the table:
   `dynamodb:GetItem,PutItem,UpdateItem,Query,BatchWriteItem` on `arn:aws:dynamodb:*:*:table/matt-grant`.
5. Deploy. Amplify gives an `*.amplifyapp.com` URL; add `mattgrantforcongress.org` under Domain management.

Notes: Amplify Next.js SSR supports App Router, route handlers, `next/og`, and middleware (Clerk).
DynamoDB needs no VPC and no connection pooling.

## Option B — OpenNext + SST / CDK (infrastructure-as-code)

If you'd rather own the infra (you already use CDK/SAM): [OpenNext](https://opennext.js.org) packages
Next.js for AWS Lambda + CloudFront + S3. With [SST](https://sst.dev) it's a few lines:

```ts
// sst.config.ts (sketch)
new sst.aws.Nextjs("MattGrant", {
  path: "web",
  environment: { DYNAMODB_TABLE: "matt-grant", /* ...Clerk, research */ },
});
```

`sst deploy --stage production`. Gives full control (IAM, custom domains, etc.) at the cost of more
setup than Amplify. Grant the server function DynamoDB access on the table.

## Option C — Container (App Runner / ECS Fargate)

Run `next start` in a container. Add a `Dockerfile` (Next standalone output), push to ECR, deploy to
**App Runner** (simplest) or **ECS/Fargate**. Most control over runtime; most ops. Only pick this if
you specifically want long-running containers.

---

## Pieces that change vs Vercel (any option)

| Concern | Vercel | AWS |
|---|---|---|
| **Cron** (research ingest) | `vercel.json` crons | **EventBridge Scheduler** → HTTPS call to `/api/research/ingest` with the `CRON_SECRET` bearer (or a tiny Lambda that curls it). `vercel.json` is ignored on AWS. |
| **Database** | Vercel Postgres / Neon | **DynamoDB** (single on-demand table). Set `DYNAMODB_TABLE`; grant the role DynamoDB IAM perms. No VPC / connection pooling. |
| **Secrets** | env vars / secrets-sync | **SSM** is already your source of truth. Set Amplify env vars from it (or have the app read SSM at runtime). The `secrets-sync` GitHub Action targets Vercel — drop it if you go all-AWS. |
| **Image optimization** | built-in | Amplify supports `next/image`; for OpenNext it's handled by the image Lambda. |

### Operational setup (cron, PITR, retention, alerting)

Amplify does **not** provision the cron jobs, DynamoDB backups, log retention, or alarms. These are
codified in **`infra/setup-aws.sh`** (see `infra/README.md`) — one idempotent, reviewable script that
wires the scheduled jobs (`/api/research/ingest` weekly + `/api/cron/email-drain` and
`/api/cron/social-drain` every minute) via EventBridge, enables DynamoDB PITR, caps CloudWatch log
retention, and sets a Lambda-errors
alarm. Run it after the first deploy:

```bash
CRON_SECRET=... BASE_URL=https://mattgrantforcongress.org \
ALERT_EMAIL=you@example.com bash infra/setup-aws.sh
```

`vercel.json` has been removed — it was ignored on Amplify and falsely implied the cron ran. The
remaining HIGH items (secrets out of the build artifact, IAM scoping, secret rotation) are tracked in
`infra/README.md`.

---

## Recommendation

**Amplify Hosting (Option A)** — least work, managed SSR, you already pay for AWS, and the repo is
already set up for it. Move to **OpenNext/SST** only if you want everything in CDK alongside your
other infra. Keep **SSM** as the secret source either way; the rest of the go-live steps
(`docs/RUNBOOK.md`) are identical — just set env vars in Amplify instead of Vercel.
