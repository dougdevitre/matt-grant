# Matt Grant for Congress — Web App

The campaign's public website **and** internal campaign manager, in one Next.js app.

- **Public site** (`/`) — home, about/issues, donate (WinRed), press, contact. Fast, SEO-ready.
- **Campaign manager** (`/dashboard`) — staff-only war room: fundraising thermometer, donor ledger
  (with FEC employer/occupation tracking + limit flags), volunteer pipeline, task board, milestone
  timeline, and the strategic plan to win on **August 4, 2026**.

## Stack

Next.js 15 (App Router) · Tailwind CSS · Prisma + PostgreSQL · Clerk auth · deploys on Vercel.

Fonts: Fraunces (display) · Public Sans (body) · Spline Sans Mono (data).

## Local setup

```bash
cd web
npm install
cp .env.example .env.local      # fill in DATABASE_URL + Clerk keys
npm run db:push                 # create tables
npm run db:seed                 # load illustrative sample data
npm run dev                     # http://localhost:3000
```

The app **builds and runs without any keys**: without `DATABASE_URL` the dashboard shows empty
state with a setup notice; without Clerk keys the dashboard runs in open "demo mode" (no sign-in).
Add keys to turn on real auth and data.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (Vercel Postgres / Neon / Supabase). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Staff auth for `/dashboard`. |

## Deploy (Vercel)

1. Import the repo; set **Root Directory** to `web`.
2. Add the env vars above (Vercel Postgres provisions `DATABASE_URL` automatically).
3. Build command `npm run build` runs `prisma generate` then `next build`.
4. After first deploy, run `npm run db:push` and `npm run db:seed` against the prod DB.

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
