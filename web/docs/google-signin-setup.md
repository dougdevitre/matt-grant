# Sign in with Google — Clerk staff + public login

How to add a **Sign in with Google** button to `/sign-in` and `/sign-up`. Auth is 100% **Clerk** (`lib/auth.ts`), so **one Google connection serves everyone** — staff and public supporters use the same flow. What differs is the role each lands with (decided by the allowlist + webhook, below), not the login mechanism.

> **This is a *different* Google integration than YouTube posting.** Sign-in uses **basic, non-restricted** scopes (`openid email profile`) and needs no Google audit. YouTube posting uses the **restricted** `youtube.upload` scope and a separate OAuth client — see [`google-youtube-setup.md`](./google-youtube-setup.md). Keep them on **separate OAuth clients** (one Google Cloud project is fine) so the restricted scope never drags the login flow into Google's audit.

---

## Prerequisites

- **Clerk is live:** both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in the deploy env (`lib/auth.ts:5` gates on both). If blank, `/sign-in` shows "not configured" and no social login renders.
- Access to the **Clerk dashboard** (production instance) and the **Google Cloud Console**.

---

## No app code change

Clerk's `<SignIn />` / `<SignUp />` components (`app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`) render whatever social connections are enabled in the Clerk dashboard. Turning Google on is **pure dashboard config** — nothing to deploy.

---

## Option 1 — Clerk shared credentials (fastest; dev/preview only)

In the Clerk dashboard → **User & Authentication → SSO Connections → Add connection → Google**, leave **custom credentials off**. Clerk uses its own shared Google OAuth app. Good for development/preview; **not** for production (shows Clerk's name on the consent screen, rate-limited). Move to Option 2 before launch.

## Option 2 — Custom Google credentials (recommended for production)

1. **Google Cloud Console** → select your project (the same one as YouTube is fine).
2. **APIs & Services → OAuth consent screen** → configure if not already: User type **External**, app name, support + developer email. Scopes are the defaults `openid`, `email`, `profile` — **no restricted scopes, no audit needed**. Publish the consent screen so it isn't limited to test users.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → **Web application**. Name it e.g. *Clerk Sign-in* (keep it distinct from the YouTube posting client). Under **Authorized redirect URIs** add Clerk's callback — for this production instance it is:
   ```
   https://clerk.mattgrantforcongress.org/v1/oauth_callback
   ```
   (Clerk shows the exact value on the Google SSO connection screen; production **requires** custom credentials.)
4. Create → copy the Google **Client ID** + **Client Secret**.
5. **Clerk dashboard** → **SSO Connections → Google** → toggle **Use custom credentials** → paste the **Client ID** + **Client Secret** (scopes are the default `openid`, `email`, `profile`) → enable **for sign-up and sign-in** → **Save.**

The Google button now appears on `/sign-in` and `/sign-up`.

---

## Who gets what role

A Google sign-in creates a Clerk user with a verified email; the `user.created` webhook (`app/api/webhooks/clerk/route.ts`) stamps the RBAC role:

1. email in **`DASHBOARD_ALLOWLIST`** (and an allowlist is set) → **admin**
2. an invited **staff row** (DynamoDB) → that row's role
3. otherwise → **supporter** (public floor → lands in `/community`)

So the **same** Google button is your staff login *and* your public supporter sign-up:
- **Staff/admin:** add their email to `DASHBOARD_ALLOWLIST` (or invite them) **before** first sign-in.
- **Public supporters:** just sign in with Google → supporter → `/community`.

Requires **`CLERK_WEBHOOK_SIGNING_SECRET`** (Clerk → Webhooks → Signing Secret); without it the webhook is inert and everyone defaults to `supporter`.

---

## Verification checklist

- [ ] `/sign-in` and `/sign-up` show a **Google** button.
- [ ] An allowlisted email signing in with Google lands on the dashboard as admin.
- [ ] A non-allowlisted Google sign-in lands in `/community` as a supporter.
- [ ] (Production) the Google consent screen shows the **campaign's** name, not Clerk's (custom credentials).

## See also
- [`linkedin-setup.md`](./linkedin-setup.md) — the LinkedIn equivalent (login + posting).
- [`google-youtube-setup.md`](./google-youtube-setup.md) — Google/YouTube posting (separate OAuth client).
