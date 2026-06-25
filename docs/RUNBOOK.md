# Matt Grant for Congress — Go-Live Runbook

Manual steps to take the app from repo → production, and to enter the few pieces of
**verified data** that only a human can fetch. Each step lists the exact link. Do them in order;
later steps assume earlier ones. Anything marked **[you]** needs your account/keys/decision.

The web app lives in `web/`. Set Vercel's **Root Directory = `web`** everywhere below.

---

## 0. Accounts you'll need **[you]**

| Service | Sign up / console | Used for |
|---|---|---|
| Vercel | <https://vercel.com/signup> | hosting the app |
| AWS DynamoDB | (you have AWS) — console → DynamoDB | donors, tasks, research store (single table) |
| Clerk | <https://dashboard.clerk.com> | staff sign-in to `/dashboard` |
| Congress.gov | <https://api.congress.gov/sign-up/> | opponent legislative record |
| AWS | (you have it) — <https://console.aws.amazon.com/cloudshell> | SSM secret store |

---

## 1. Database — DynamoDB **[you]**

The app uses a single **DynamoDB** table (on-demand billing; no servers, no connection pooling).

1. Set `DYNAMODB_TABLE` (and `AWS_REGION`) in `web/.env.local` (`cp web/.env.example web/.env.local`).
   AWS creds come from your default chain — `aws configure` (local) or the IAM role (Amplify).
2. Create the table + load sample data:
   ```bash
   cd web
   npm install
   npm run db:create-table   # one PK/SK table, PAY_PER_REQUEST
   npm run db:seed           # illustrative sample data — LOCAL DEV ONLY (optional)
   ```
3. The app's IAM role/user needs `dynamodb:GetItem,PutItem,UpdateItem,DeleteItem,Query,BatchWriteItem` on the table.

> **Seeding is for local dev only — never production.** `db:seed` loads illustrative sample
> donors, volunteers, tasks, etc. It refuses to run under `NODE_ENV=production` (override with
> `ALLOW_SEED=1` only if you really mean it). Every seed row is tagged `seed: true` with a `seed-*`
> sort key so it stays identifiable.
>
> **Removing seed data from a table** (e.g. a one-time production cleanup): the cleanup is a
> deliberate, manual step — it is not wired into CI or the build.
> ```bash
> cd web
> npm run db:clean-seed              # DRY RUN — lists what it would delete, writes nothing
> CONFIRM=1 npm run db:clean-seed    # actually delete the seed rows
> ```
> It sweeps the seed partitions, deletes every `seed`-marked row, and clears any live task still
> pointing at a deleted seed volunteer. Always dry-run first and confirm the table name in the
> output before setting `CONFIRM=1`.

## 2. Clerk auth **[you]**

1. <https://dashboard.clerk.com> → create an application → **API Keys**.
2. Copy `Publishable key` and `Secret key` into `web/.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   ```
3. Add your campaign staff as Clerk users (Users → Create, or enable email invites).
   Until keys are set the dashboard runs in open "demo mode"; once set, `/dashboard` requires sign-in.

## 3. Brand photo **[you]**

1. Save Matt's headshot to `web/public/brand/matt-grant-source.png` (overwrite the placeholder).
2. `cd web && npm run brand` — regenerates favicon, OG card, portraits, avatar, print headshot.

## 4. Deploy **[you]**

Recommended: **AWS Amplify Hosting** — see [DEPLOY-AWS.md](DEPLOY-AWS.md) (you already pay for AWS).
On Vercel instead: <https://vercel.com/new> → import `dougdevitre/matt-grant`.

1. **Root Directory → `web`**. Framework auto-detects Next.js.
2. Add env vars (Production): `DYNAMODB_TABLE`, `AWS_REGION`,
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (research vars come in step 6).
3. Give the host's role DynamoDB IAM perms on the table; deploy.

## 5. SSM secrets + auto-sync **[you]**

Store secrets in SSM (source of truth) and let the GitHub Action mirror them to Vercel.

1. **AWS CloudShell** (<https://console.aws.amazon.com/cloudshell>) — load params:
   ```bash
   PREFIX="/matt-grant/research"; REGION="us-east-1"
   read -s -p "Congress.gov API key: " KEY; echo
   aws ssm put-parameter --region "$REGION" --name "$PREFIX/CONGRESS_GOV_API_KEY" --type SecureString --value "$KEY" --overwrite; unset KEY
   aws ssm put-parameter --region "$REGION" --name "$PREFIX/CRON_SECRET" --type SecureString --value "$(openssl rand -hex 32)" --overwrite
   for kv in "RESEARCH_BIOGUIDE_ID=W000812" "RESEARCH_VOTE_YEAR=2025" "RESEARCH_FROM_ROLL=1" "RESEARCH_TO_ROLL=60"; do
     aws ssm put-parameter --region "$REGION" --name "$PREFIX/${kv%%=*}" --type String --value "${kv#*=}" --overwrite
   done
   ```
2. **GitHub repo → Settings → Secrets and variables → Actions** — add:
   - `AWS_ROLE_ARN` — an IAM role GitHub can assume via OIDC
     (setup: <https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services>);
     role needs `ssm:GetParametersByPath` + `kms:Decrypt` on `/matt-grant/research/*`.
   - `VERCEL_TOKEN` — <https://vercel.com/account/tokens>
   - `VERCEL_PROJECT_ID` and `VERCEL_ORG_ID` — Vercel project Settings → General (or `.vercel/project.json`)
   - `VERCEL_DEPLOY_HOOK` *(optional)* — Vercel project Settings → Git → Deploy Hooks
3. Run it: GitHub → Actions → **secrets-sync** → Run workflow. It upserts every
   `/matt-grant/research/*` param into Vercel production env. (Also runs daily.)

## 6. Turn on opponent research ingestion **[you]**

1. Env vars present (from step 5 sync, or added manually): `CONGRESS_GOV_API_KEY`,
   `CRON_SECRET`, `DYNAMODB_TABLE`. Redeploy so they load.
2. Trigger the first ingest:
   ```bash
   curl -X POST -H "authorization: Bearer <CRON_SECRET>" https://<your-domain>/api/research/ingest
   ```
   (`vercel.json` also runs it weekly, Mondays 08:00 UTC.)
3. View at `/dashboard/research`. Verify a vote links to `clerk.house.gov` and a bill to `congress.gov`.
4. **Confirm the bioguide ID** once: <https://api.congress.gov/v3/member?currentMember=true&stateCode=MO&api_key=YOUR_KEY>
   — find Wagner's `bioguideId` (expected `W000812`); fix `RESEARCH_BIOGUIDE_ID` if it differs.

## 7. Rural-county turnout (the data I can't auto-fetch) **[you]**

The map shows Jefferson/Washington/Crawford/Gasconade as boundaries. They'll **shade by turnout the
moment you enter verified numbers** — no code needed, just data.

1. Go to SOS results: <https://www.sos.mo.gov/elections/resultsandstats/previouselections>
   → open **"August 6, 2024 Primary Election"** results / **Election Night Reporting**.
2. For each county, note **ballots cast** and **registered voters** (turnout % = ballots ÷ registered ×100).
   Registered-voter counts: <https://www.sos.mo.gov/elections/registeredvoters>.
3. Edit `web/lib/countyTurnout.ts` — uncomment and fill each entry with the **source URL**:
   ```ts
   export const COUNTY_TURNOUT = {
     Jefferson:  { registered: 0, ballots: 0, turnoutPct: 0, asOf: "Aug 6 2024 primary", sourceUrl: "https://..." },
     Washington: { registered: 0, ballots: 0, turnoutPct: 0, asOf: "Aug 6 2024 primary", sourceUrl: "https://..." },
     Crawford:   { registered: 0, ballots: 0, turnoutPct: 0, asOf: "Aug 6 2024 primary", sourceUrl: "https://..." },
     Gasconade:  { registered: 0, ballots: 0, turnoutPct: 0, asOf: "Aug 6 2024 primary", sourceUrl: "https://..." },
   };
   ```
4. Commit + redeploy. Those counties now shade by turnout (gold→brick) and the popup shows the %.
   Leave any county out until you have its real number — empty = flat boundary, never a guess.

## 8. Domain (optional) **[you]**

Point `mattgrantforcongress.org` at Vercel: project → Settings → Domains → add the domain and follow
the DNS records. Update `metadataBase` in `web/app/layout.tsx` if the canonical host changes.

---

## Verify checklist

- [ ] `/` loads; favicon + OG card show Matt's photo (not the MG placeholder)
- [ ] `/dashboard` requires Clerk sign-in (not demo mode)
- [ ] Donors/Finance/Tasks read & write against the DB
- [ ] `/dashboard/map` shows St. Louis turnout columns + all 5 counties' boundaries
- [ ] `/dashboard/research` shows Wagner's votes/bills with working source links
- [ ] secrets-sync Action run is green; Vercel env has the research vars
- [ ] (when entered) rural counties shade by turnout with a cited `sourceUrl`

_Paid for by the Matt Grant for Congress Committee._
