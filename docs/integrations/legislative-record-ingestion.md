# Legislative Record Ingestion — Integration (matt-grant stack)

> Status: **Implemented** · Adapted from the proposed AWS/DynamoDB plan to this repo's
> actual stack: **Next.js + Prisma/PostgreSQL + Clerk on Vercel** (no AWS).

## Purpose

Pull the opponent's (Ann Wagner, MO-02) **public legislative record** — member profile,
sponsored/cosponsored legislation, roll-call vote positions — from primary federal sources into the
campaign app so contrast research is sourceable and fact-checkable. All data is public record
(Congress.gov API + House Clerk roll-call XML). Every stored row carries its primary `sourceUrl`.

## Stack reconciliation (vs the original plan)

| Plan assumed | This repo |
|---|---|
| AWS Lambda + EventBridge | Next.js route handler + **Vercel Cron** (`vercel.json`) |
| DynamoDB single-table + S3 snapshot | **Prisma/PostgreSQL** models (`Legislator`/`LegVote`/`LegBill`/`IngestRun`) |
| SSM SecureString secrets | **Vercel env** (`CONGRESS_GOV_API_KEY`, `CRON_SECRET`) |
| Express router + `requireStaff` | Next.js routes; **Clerk** middleware gates `/api/research/member(*)` |
| `wagner-ingest` modules copied in | Built fresh under `web/lib/integrations/legislative/` |

## Files

```
web/lib/integrations/legislative/
├── types.ts            # NormalizedDataset + record shapes
├── config.ts           # env-based (key, bioguide, vote year, roll range)
├── congressClient.ts   # Congress.gov v3 (member, sponsored, cosponsored; paginated)
├── clerkVotes.ts       # House Clerk roll{NNN}.xml → member position (bioguide = @name-id)
├── store.ts            # Prisma upserts (idempotent) + read helpers
└── ingest.ts           # orchestrator; records an IngestRun
web/app/api/research/
├── ingest/route.ts                       # GET (cron) + POST; CRON_SECRET bearer
└── member/[bioguideId]/{route,votes,bills}/route.ts   # Clerk-gated reads
web/app/dashboard/research/page.tsx       # staff UI (votes + bills, source links, filters)
web/vercel.json                           # weekly cron (Mon 08:00 UTC)
```

## Data model (Prisma)

- `Legislator` (PK `bioguideId`) — profile + party/state/district.
- `LegVote` — `@@unique([bioguideId, year, rollNumber])` → idempotent upsert.
- `LegBill` — `@@unique([bioguideId, relation, congress, billType, number])`.
- `IngestRun` — run status/counts/errors for visibility.

## Security

- `/api/research/ingest` refuses to run unless `CRON_SECRET` is set and presented as a bearer token
  (Vercel Cron sends it automatically). Reads are Clerk-gated via middleware.
- API key lives in Vercel env, never shipped to the client, never logged.
- This is public data, but the internal store stays staff-only.

## Run it

1. Add env: `DATABASE_URL`, `CONGRESS_GOV_API_KEY`, `CRON_SECRET` (+ optional `RESEARCH_*`).
2. `npm run db:push` to create the tables.
3. Trigger once: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/research/ingest`.
4. View at `/dashboard/research`. Weekly cron keeps it fresh.

## Notes / edge cases

- **Bioguide ID** — default `W000812` (Ann Wagner). Verify via
  `/member?currentMember=true&stateCode=MO` before production.
- **Roll range** — Clerk votes are fetched sequentially `fromRoll..toRoll`; keep the range modest
  (cron `maxDuration` = 300s). Widen once confirmed. 404 rolls are skipped (gaps are normal).
- **Idempotent** — all writes upsert on stable keys; re-runs never duplicate.
- **Degrades gracefully** — no DB → setup notice; no key → research page explains how to enable.
- **Not run here** — live ingestion needs the API key + a connected DB; the build is verified but no
  live fetch was performed in this environment.

## Follow-on

- FEC finance ingestion (same data.gov key, same pattern) for finance-sector contrast.
- A downstream "contrast picker" that pairs sourced votes with Matt's positions
  (`candidate/contrast-positioning.md`) — kept separate from this read-only ingestion layer.
