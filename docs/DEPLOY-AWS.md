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

### EventBridge cron for the weekly ingest

```bash
# one-time: schedule a weekly POST to the ingest endpoint
aws scheduler create-schedule --name matt-grant-research-ingest \
  --schedule-expression "cron(0 8 ? * MON *)" \
  --flex-time-window '{"Mode":"OFF"}' \
  --target '{
    "Arn":"arn:aws:scheduler:::http-invoke",
    "RoleArn":"<scheduler-role-arn>",
    "HttpParameters":{"HeaderParameters":{"authorization":"Bearer <CRON_SECRET>"}},
    "Input":"",
    "RetryPolicy":{"MaximumRetryAttempts":2}
  }' \
  --target-endpoint "https://<your-domain>/api/research/ingest"
```

(If EventBridge HTTP-invoke isn't enabled in your account, use a 10-line Lambda that `fetch`es the
endpoint with the bearer header, scheduled by EventBridge.)

---

## Recommendation

**Amplify Hosting (Option A)** — least work, managed SSR, you already pay for AWS, and the repo is
already set up for it. Move to **OpenNext/SST** only if you want everything in CDK alongside your
other infra. Keep **SSM** as the secret source either way; the rest of the go-live steps
(`docs/RUNBOOK.md`) are identical — just set env vars in Amplify instead of Vercel.
