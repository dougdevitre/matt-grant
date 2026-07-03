# Social sign-in — verification runbook

How to configure and verify **"Sign in with Google / Facebook / LinkedIn"** for people logging into the campaign app, and confirm that a successful sign-in **lands the user on the dashboard**. This is the end-user *login* flow (Clerk), **not** the separate flow that connects the campaign's own posting accounts — that one is [`social-go-live.md`](./social-go-live.md).

> **This is operational setup, not legal advice.** Each provider's OAuth terms and app-review rules are theirs — read them before enabling at scale.

---

## How it works (what this repo controls vs. what Clerk controls)

User login is handled entirely by **Clerk**. The social buttons on `/sign-in` and `/sign-up` are rendered by Clerk's `<SignIn/>` / `<SignUp/>` components, and each provider (Google, Facebook, LinkedIn) is enabled and configured in the **Clerk dashboard** — there is no provider-specific code in this repo.

What the repo *does* control is the **landing after sign-in**:

1. `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` render Clerk with `fallbackRedirectUrl="/go"`.
2. `app/go/page.tsx` (the post-auth router) resolves the signed-in user's role via `staffGate()` and redirects using `postAuthDestination(role)` (`lib/rbac.ts`):
   - staff (**admin / captain / volunteer**) → **`/dashboard`**
   - Peace-Room tiers (**partner / donor / supporter**) → **`/dashboard/peace-room`**
   - not-yet-stamped brand-new signup (role `null`) → **`/community`** (public floor)
3. A user bounced from a protected page keeps their own `redirect_url` (set in `middleware.ts`); only *direct* sign-ins fall through to `/go`.

So: **a staff user who signs in with Google/Facebook/LinkedIn lands on `/dashboard`.** A brand-new public self-signup lands on `/community` by design — that is not a bug.

The redirect logic (steps 1–2) is covered by automated tests: `lib/rbac.test.ts` (`postAuthDestination`), `app/go/go.test.ts` (GoPage per role), and `app/sign-in/sign-in-redirect.test.ts` (the `fallbackRedirectUrl="/go"` wiring). Run them with `npm test`. The interactive provider handshake below can only be verified by hand.

---

## 1. Enable each provider in Clerk

In the **Clerk dashboard** → **User & Authentication → Social Connections**, toggle each provider on. Clerk shows the exact **Authorized redirect URI** to register in the provider's console (it points at Clerk's frontend API, e.g. `https://<your-clerk-frontend-api>/v1/oauth_callback`, **not** at this app). For production, use **custom credentials** (your own OAuth app) rather than Clerk's shared dev keys.

| Provider | Where you create the OAuth app | Redirect URI to register | Gotchas |
|---|---|---|---|
| **Google** | Google Cloud Console → APIs & Services → **Credentials** → OAuth client ID (Web application). Configure the **OAuth consent screen** first. | The **Authorized redirect URI Clerk shows** for the Google connection. | Scopes `openid email profile` are enough. While the consent screen is in **Testing**, only listed test users can sign in — **Publish** it before launch. |
| **Facebook** | Meta for Developers → create an app → add **Facebook Login** → Settings. | The **redirect URI Clerk shows** goes in **Valid OAuth Redirect URIs**. | Requests `email` + `public_profile`. The app must be **Live** (not Development) for anyone outside the app's roles to sign in; email verification/business rules apply. |
| **LinkedIn** | LinkedIn Developers → create an app → **Auth** tab. | The **redirect URL Clerk shows** goes in **Authorized redirect URLs**. | Add the **"Sign In with LinkedIn using OpenID Connect"** product; scopes `openid profile email`. |

Paste each provider's **Client ID / Secret** into the matching Clerk connection.

---

## 2. App environment

Set these on the deployment being tested (see the Clerk block in [`../.env.example`](../.env.example)):

| Var | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | your Clerk publishable key | Without both keys the app runs in **demo mode** (open dashboard, no real login) and this flow can't be tested. |
| `CLERK_SECRET_KEY` | your Clerk secret key | — |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Points Clerk redirects at the in-app pages. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | — |
| `DASHBOARD_ALLOWLIST` | a test staffer's email | Fastest way to make a social sign-in resolve to **admin** → `/dashboard` without stamping a role first (`emailAllowed()` in `lib/auth.ts`). |

> Real social login **cannot** run in CI or the sandbox — CI runs demo mode (Clerk keys blank; see `playwright.config.ts`). This runbook is the human verification path; the redirect logic is what's covered by the automated tests above.

---

## 3. Verify each provider end-to-end

For each provider, from a signed-out browser:

1. Open **`/sign-in`**.
2. Click the provider button (**Google** / **Facebook** / **LinkedIn**).
3. Complete the provider's login + consent.
4. Confirm you are returned to the app and **land on the expected page** (below).

Also verify:
- **Deep-link bounce:** while signed out, open `/dashboard/social` directly → you're sent to `/sign-in`; after a social sign-in you return to **`/dashboard/social`** (the `redirect_url` is honored, not `/go`).
- **New public signup:** a first-time sign-up with a non-allowlisted email lands on **`/community`** (expected — supporters are the public tier).

### Results matrix (fill in each run)

| Provider | Signed in as | Expected landing | Actual landing | Pass? | Notes |
|---|---|---|---|---|---|
| Google | allowlisted staff email | `/dashboard` | | | |
| Facebook | allowlisted staff email | `/dashboard` | | | |
| LinkedIn | allowlisted staff email | `/dashboard` | | | |
| Google | new public account | `/community` | | | |
| any | deep-link `/dashboard/social` bounce | `/dashboard/social` | | | |

---

## Troubleshooting

- **Redirect/URI mismatch error at the provider:** the URI in the provider console must match the one Clerk shows **exactly** (scheme, host, path, trailing slash).
- **Signed in but landed on the wrong page:** check the resolved role. `postAuthDestination` sends only staff to `/dashboard`; donor/supporter/partner go to `/dashboard/peace-room`, and an unstamped account goes to `/community`. Add the email to `DASHBOARD_ALLOWLIST` or stamp a staff role to reach `/dashboard`.
- **No social buttons appear:** the connection isn't enabled in the Clerk dashboard, or the app is in demo mode (Clerk keys unset).

## Known follow-up (not a blocker)

`postAuthDestination` (app/go) and `homeFor` (the "your account" nav link, also in `lib/rbac.ts`) **disagree for donors**: post-auth sends a donor to `/dashboard/peace-room`, while their account link points to `/my-giving`. Both are intentional today; reconciling them is a separate product decision, tracked here so it isn't lost.
