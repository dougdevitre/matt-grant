# Legislative Record Ingestion — Integration (matt-grant stack)

> Status: **Implemented** · Stack: **Next.js + AWS DynamoDB (single table) + Clerk**, deployed on
> **AWS Amplify** (Vercel optional). This matches the original plan's DynamoDB storage intent.

## Purpose

Pull the opponent's (Ann Wagner, MO-02) **public legislative record** — member profile,
sponsored/cosponsored legislation, roll-call vote positions — from primary federal sources into the
campaign app so contrast research is sourceable and fact-checkable. All data is public record
(Congress.gov API + House Clerk roll-call XML). Every stored row carries its primary `sourceUrl`.

## How it maps to the original plan

| Plan | This repo |
|---|---|
| Scheduled ingest | Next.js route handler; cron via **Vercel Cron** or **EventBridge** on AWS |
| **DynamoDB single-table** | ✅ DynamoDB single table (items keyed by PK/SK in `lib/db.ts`) |
| SSM SecureString secrets | ✅ **SSM** `/matt-grant/*` (→ host env) |
| Staff-gated reads | Next.js routes; **Clerk** middleware gates `/api/research/member(*)` |
| `wagner-ingest` modules | Built fresh under `web/lib/integrations/legislative/` |

## Files

```
web/lib/integrations/legislative/
├── types.ts            # NormalizedDataset + record shapes
├── config.ts           # env-based (key, bioguide, vote year, roll range)
├── congressClient.ts   # Congress.gov v3 (member, sponsored, cosponsored; paginated)
├── clerkVotes.ts       # House Clerk roll{NNN}.xml → member position (bioguide = @name-id)
├── store.ts            # DynamoDB upserts (idempotent) + read helpers
└── ingest.ts           # orchestrator; records an IngestRun item
web/app/api/research/
├── ingest/route.ts                       # GET (cron) + POST; CRON_SECRET bearer
└── member/[bioguideId]/{route,votes,bills}/route.ts   # Clerk-gated reads
web/app/dashboard/research/page.tsx       # staff UI (votes + bills, source links, filters)
web/vercel.json                           # weekly cron (Vercel); EventBridge on AWS
```

## Data model (DynamoDB single-table, idempotent upserts)

- Legislator — `PK=LEGISLATOR`, `SK=<bioguideId>`.
- Vote — `PK=VOTES#<bioguideId>`, `SK=<year>#<roll4>`.
- Bill — `PK=BILLS#<bioguideId>`, `SK=<relation>#<congress>#<type>#<number>`.
- IngestRun — `PK=INGESTRUN#<bioguideId>`, `SK=<startedAt ISO>` (latest = query desc, limit 1).

## Security

- `/api/research/ingest` refuses to run unless `CRON_SECRET` is set and presented as a bearer token
  (Vercel Cron sends it automatically). Reads are Clerk-gated via middleware.
- API key lives in Vercel env, never shipped to the client, never logged.
- This is public data, but the internal store stays staff-only.

## Run it

1. Add env: `DYNAMODB_TABLE`, `AWS_REGION`, `CONGRESS_GOV_API_KEY`, `CRON_SECRET` (+ optional `RESEARCH_*`).
2. `npm run db:create-table` to create the table (research items share the app's single table).
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
