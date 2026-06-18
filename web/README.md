# Matt Grant for Congress — Web App

The campaign's public website **and** internal campaign manager, in one Next.js app.

- **Public site** (`/`) — home, about/issues, donate (WinRed), press, contact. Fast, SEO-ready.
- **Campaign manager** (`/dashboard`) — staff-only war room: fundraising thermometer, donor ledger
  (with FEC employer/occupation tracking + limit flags), volunteer pipeline, task board, milestone
  timeline, and the strategic plan to win on **August 4, 2026**.

## Stack

Next.js 15 (App Router) · Tailwind CSS · AWS DynamoDB (single table) · Clerk auth · deploys on
AWS Amplify (or Vercel).

Fonts: Fraunces (display) · Public Sans (body) · Spline Sans Mono (data).

## Local setup

```bash
cd web
npm install
cp .env.example .env.local      # fill in DYNAMODB_TABLE + AWS_REGION + Clerk keys
npm run db:create-table         # create the DynamoDB table (needs AWS creds)
npm run db:seed                 # load illustrative sample data
npm run dev                     # http://localhost:3000
```

The app **builds and runs without any keys**: without `DYNAMODB_TABLE` the dashboard shows empty
state with a setup notice; without Clerk keys the dashboard runs in open "demo mode" (no sign-in).
Add keys to turn on real auth and data.

## Environment

| Variable | Purpose |
|---|---|
| `DYNAMODB_TABLE` / `AWS_REGION` | DynamoDB table (creds via IAM role or AWS chain). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Staff auth for `/dashboard`. |

## Deploy

See [`../docs/DEPLOY-AWS.md`](../docs/DEPLOY-AWS.md) (Amplify recommended) and
[`../docs/RUNBOOK.md`](../docs/RUNBOOK.md) for the full go-live steps. Root Directory is `web`;
the app's IAM role needs DynamoDB read/write on the table.

## Brand assets (Matt's photo → every size)

One headshot drives the favicon, social share card, portraits, profile photo, and the in-app
graphics studio.

```bash
# 1. Save the real headshot here (overwrite the placeholder):
#    web/public/brand/matt-grant-source.png   (or .jpg)
# 2. Regenerate every derived asset:
npm run brand
```

This produces `public/brand/` (icon-16/32/48/192/512, og-card 1200×630 with photo + slogan,
portrait-400/800/1200, avatar-circle) plus `app/icon.png` + `app/apple-icon.png` (favicon /
Apple touch icon). The site's OG card, favicon, and About/Home portraits use them automatically.

**Graphics studio** (`/dashboard/studio`) generates campaign graphics — IG/FB square & story, X
header, Facebook cover, web banner, yard sign — from the photo with editable copy and a one-click
PNG download, via the `/api/graphics` route. Until the real photo is dropped in, a branded "MG"
placeholder stands in.

## Notes

- Donor PII lives in the database — handle securely (see repo `SECURITY.md`).
- Dashboard numbers (goals, vote math) are **illustrative planning placeholders**, not predictions.
- Compliance tooling is educational, not legal advice — verify with the FEC and Missouri Ethics Commission.

_Paid for by the Matt Grant for Congress Committee._
