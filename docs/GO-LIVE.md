# Go-Live: point mattgrantforcongress.org at the new app

The Next.js app (all compliance work included) is built and **live now** at the
Amplify URL — it just isn't on the public domain yet. This is the cutover runbook
for when you're ready to launch. Diagnosed 2026-06-18.

## Current state

| Thing | Value |
|---|---|
| Amplify app | `matt-grant` · appId **`d1roai8s7wowoi`** · auto-build ON for `main` |
| Live new-app URL | **https://main.d1roai8s7wowoi.amplifyapp.com** (verified: `/data-policy` renders) |
| Custom domain on Amplify | **none** (`domainAssociations: []`) |
| `mattgrantforcongress.org` currently serves | An **existing WordPress site** — `67.223.118.124`, LiteSpeed/PHP 8.2 |
| DNS host | **Namecheap** (`dns1/dns2.namecheaphosting.com`); apex `A → 67.223.118.124`, `www → ` same |

⚠️ **Cutover replaces the live WordPress site for this domain.** Coordinate timing; have someone who can edit Namecheap DNS on hand.

## Pre-flight (do first)

1. Confirm the latest `main` build is green: `aws amplify list-jobs --app-id d1roai8s7wowoi --branch-name main --max-results 1`.
2. Smoke-test the Amplify URL: home, `/donate`, `/contact`, `/data-policy`, `/transparency`, `/public-trust`, footer "Paid for by" + legal links.
3. Decide apex strategy (see note below) — Namecheap can't CNAME the apex.

## Steps

1. **Associate the domain in Amplify** (Console → App → Domain management → Add domain, or CLI):
   ```
   aws amplify create-domain-association \
     --app-id d1roai8s7wowoi \
     --domain-name mattgrantforcongress.org \
     --subdomain-settings prefix=,branchName=main prefix=www,branchName=main
   ```
2. **Read back the records Amplify wants** (Console shows them; or `aws amplify get-domain-association --app-id d1roai8s7wowoi --domain-name mattgrantforcongress.org`):
   - one or more **ACM certificate validation `CNAME`s** (ownership/SSL),
   - the **target** to point `www` (and apex) at (a CloudFront-backed hostname).
3. **In Namecheap DNS**, add the ACM validation CNAME(s), then repoint traffic:
   - `www` → **CNAME** to Amplify's target (straightforward).
   - **apex** `@` → Namecheap doesn't support CNAME/ALIAS on the apex. Two options:
     - **(Recommended) Move the domain's DNS to Route 53**, then Amplify manages apex via an ALIAS automatically. Cleanest, fully supported.
     - **Or** keep Namecheap: point `www` to Amplify and set the **apex to redirect to `www`** (Namecheap URL redirect), so the canonical site is `www.mattgrantforcongress.org`.
   - **Remove** the old `A → 67.223.118.124` records once cut over.
4. **Wait** for Amplify domain status `AVAILABLE` (SSL cert issues via DNS validation; allow 15 min–a few hours).
5. **Verify**: `curl -sI https://mattgrantforcongress.org/` should now show CloudFront/Amplify headers (not LiteSpeed); `/data-policy` should render; re-run the axe scan (see `web/docs/compliance-audit.md`).

## Rollback

Revert the Namecheap records to `A → 67.223.118.124` (apex + www). DNS TTL governs how fast it reverts — consider **lowering the TTL** a day before cutover to make rollback fast.

## After go-live

- Update anything still pointing at the Amplify URL.
- Re-confirm Clerk allowed origins / redirect URLs include the production domain.
- Re-verify the live site against `web/docs/compliance-audit.md` (footer disclaimer, policy pages, donate disclosures).
