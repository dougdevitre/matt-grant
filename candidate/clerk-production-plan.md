# Clerk — Production Test & Go-Live Plan

Where we are: a Clerk **Development** instance (`pk_test_…`) is wired to the live Amplify site, the
dashboard is gated, and the **email allowlist** (`DASHBOARD_ALLOWLIST`) backstops authorization. Live
checks already pass — `/dashboard` → 307 `/sign-in`, protected APIs → 401, `/sign-in` renders.

A Clerk **Production** instance (`pk_live_…`) is **domain-bound**, so going to production is tied to
putting a real domain on the site.

## Phase A — Validate the current (dev) setup on the live site

Do this now; it needs no new infrastructure. Sign up at `…amplifyapp.com/sign-in`.

| # | Test | Expected |
|---|---|---|
| 1 | Sign up with `dougdevitre@gmail.com` (allowlisted) | Email verification, then lands in the dashboard |
| 2 | Sign out (UserButton, top-right) | Back to public site; `/dashboard` → `/sign-in` again |
| 3 | Sign up with a **non-allowlisted** email | Allowed to authenticate, but dashboard redirects to `/?staff=denied` |
| 4 | Protected API while signed out | `401` (e.g. `/api/assets/list`) |
| 5 | Protected API while signed in but not allowlisted | `403` |
| 6 | Reload / mobile | Session persists; works on phone |
| 7 | Public pages (`/`, `/issues`, `/donate`) | No auth wall |

Note: the dev instance shows a "development" banner, uses a `*.accounts.dev` portal, and has user
limits — fine for staff testing, not for public launch.

## Phase B — Stand up the Clerk PRODUCTION instance

1. **Custom domain first** (prerequisite): point `mattgrantforcongress.org` (or an app subdomain) at
   Amplify — add the domain in Amplify Hosting and set the DNS it provides.
2. In Clerk, **create/activate the Production instance** for that domain.
3. **Add Clerk's DNS records** to the domain — the `clerk.`, `accounts.`, and email/DKIM
   (`clkmail`, `clk._domainkey`) CNAMEs — and wait for SSL + verification to go green.
4. **Production keys:** copy `pk_live_…` + `sk_live_…` → SSM `/matt-grant/*` → Amplify env →
   redeploy (the `.env.production` materialization is already wired). Replace the dev keys.
5. **Configure the prod instance:** sign-in/up URLs (`/sign-in`, `/sign-up`), allowed origins (the
   prod domain), session lifetime, and any social login with **production** OAuth apps.
6. **Restrict sign-ups to invitation-only**; invite staff, and keep `DASHBOARD_ALLOWLIST` in sync.
7. **Branding:** set Clerk's appearance (logo/colors) to match the campaign.

## Phase C — Production smoke test (on the prod domain)

Re-run the Phase-A table on the prod domain, plus:

- No "development" banner; account portal on `accounts.mattgrantforcongress.org`.
- Clerk's verification / magic-link emails **deliver from the campaign domain** — check inbox + spam,
  confirm DKIM is green (sender reputation).
- Password-reset flow works.
- **Invite flow:** invite a staff email → they accept → access granted; a stranger can't self-register.
- Remove/rotate the **dev** keys once prod is verified.

## Guardrails

- Keep `DASHBOARD_ALLOWLIST` as the authorization backstop even with invite-only sign-ups.
- Secrets stay in SSM → Amplify (already materialized into `.env.production`).
- Never expose donor/finance/research to non-staff.

## Who does what

- **I can:** run the curl-level checks (redirects, 401/403, public site), and wire `pk_live`/`sk_live`
  into SSM + Amplify + redeploy when you have them.
- **You own (Clerk dashboard / registrar):** create the prod instance, add DNS, set invite-only, and
  invite users — plus the domain decision.

_Paid for by Matt Grant for Congress._
