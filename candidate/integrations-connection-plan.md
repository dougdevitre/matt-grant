# Integrations — Connection Status & Plan

Every data API, connector, and webhook in the app, what's live, and exactly what it takes to connect
the rest. Secrets live in **SSM `/matt-grant/*`** and are mirrored to the **Amplify** SSR runtime
(via `amplify.yml` materialization + the compute role). Source of truth = SSM; I push to Amplify.

## Status

| Integration | Type | Status | To connect |
|---|---|---|---|
| DynamoDB (donors, finance, volunteers, tasks, staff) | data | ✅ **live** | done — compute role + seeded |
| S3 + CloudFront (assets, photos, signed URLs) | data | ✅ **live** | done |
| Clerk auth (sign-in, allowlist, roles) | connector | ✅ **live (dev)** | prod instance needs a domain → `clerk-production-plan.md` |
| St. Louis County GIS (polling, precinct turnout, county VTDs) | data API | ✅ **live** | done — public ArcGIS, no key |
| **Clerk webhook** (user.created → role mirror) | webhook | ✅ **live** | done — endpoint verifies the signing secret at runtime (unsigned probe → 400 `invalid signature`; signed `user.created` → role mirror) |
| **AWS SES** (receipts, invites, broadcast) | connector | ⏳ **pending verify** | click the AWS "verify email" link sent to `mattgrantforcongress@gmail.com` (or verify the domain for deliverability) |
| **Walgreens** Native Photo Prints | data API | ⏳ **pending affId** | the real **Affiliate ID** from Walgreens (request email already drafted) → paste to me |
| **Congress.gov** opp-research ingest | data API + cron | 🟡 **cron live, key pending** | `CRON_SECRET` + the **EventBridge daily schedule** (11:00 UTC → `/api/research/ingest`) are wired and no-op cleanly. Just paste a free key from api.congress.gov/sign-up → I load `CONGRESS_GOV_API_KEY` and ingest starts flowing |
| **Anthropic** (AI press-topic generator) | connector | 🔌 **not connected** | paste an Anthropic API key → I load `ANTHROPIC_API_KEY` (falls back to curated until then) |
| **WinRed** donation webhook (→ thank-you email) | webhook | ☐ **not built** | I build `/api/webhooks/winred` when you want it (needs WinRed's webhook + a shared secret) |

## What I can wire the moment you hand me each value

Paste me these and I'll load SSM + Amplify + redeploy + verify — no dashboards on your end after:
1. **Clerk webhook signing secret** (`whsec_…`) → `CLERK_WEBHOOK_SIGNING_SECRET`. (You create the endpoint in Clerk; I do the rest. The `amplify.yml` already pulls this from SSM.)
2. **Congress.gov key** → `CONGRESS_GOV_API_KEY`; I also generate `CRON_SECRET` and stand up the **EventBridge daily schedule** that POSTs `/api/research/ingest` with the bearer.
3. **Anthropic key** → `ANTHROPIC_API_KEY`.
4. **Walgreens Affiliate ID** → `WALGREENS_AFF_ID` (then I re-test the product catalog).

## What needs a click only you can do
- **SES:** click the verification email (turns on all email sending).
- **Clerk webhook:** create the endpoint in the Clerk dashboard (I can't add it via API in your account).

## Infra cleanups (I can do now)
- **`secrets-sync.yml` targets Vercel**, but we deploy on **Amplify** — it's dead weight. Repoint it to push SSM → Amplify env (so future key changes are hands-off), or retire it. Recommend **repoint**.
- **Pre-wire the research cron:** generate `CRON_SECRET` + create the EventBridge schedule now (it no-ops safely until the Congress key lands, then starts ingesting).

## Suggested order
1. **SES verify click** (unlocks receipts + invites + broadcast) — biggest immediate win.
2. **Anthropic key** (1 paste → AI press topics live).
3. **Clerk webhook** (role mirror to JWT) — paste secret.
4. **Congress.gov key** + I wire the cron (opp research starts flowing).
5. **Walgreens affId** when it arrives.
6. **WinRed webhook** + **Clerk prod/domain** as larger follow-ups.

_Paid for by the Matt Grant for Congress Committee._
