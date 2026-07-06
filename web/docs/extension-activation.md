# Activating the Chrome extension surface

The captain Chrome extension talks to the app through [`/api/ext/*`](./extension-api.md). That
surface is **fail-closed** — it does nothing until it's turned on. This is the step-by-step to
turn it on for the live (AWS Amplify) deployment, and how to confirm it worked.

Educational/operational reference for the campaign; not legal advice.

## What has to be true

Three env vars, plus one Clerk setting:

| Var | Read at | Purpose |
|---|---|---|
| `EXTENSION_ORIGIN` | runtime (`web/lib/http/cors.ts`) | CORS allowlist — which `chrome-extension://<id>` may read `/api/ext/*` responses |
| `CLERK_AUTHORIZED_PARTIES` | runtime (`web/middleware.ts`) | Clerk token `azp` allowlist — which origins' session tokens are trusted |
| `NEXT_PUBLIC_EXTENSION_STORE_URL` | build (inlined) | the Install button target on `/dashboard/extension` |

## The Amplify gotcha (read this first)

Amplify only exposes an env var to the **SSR runtime** if `amplify.yml` **materializes it into
`.env.production`** (the `printenv` loop). Setting a runtime var in the Amplify console *alone*
does **not** reach the running app — it would stay dark with no error. The three vars above are
already in that loop (see `amplify.yml`, "gate the Chrome-extension API" comment). If you add
more, add them there too.

## Steps

1. **Amplify console → App settings → Environment variables**, set:
   - `EXTENSION_ORIGIN` = `chrome-extension://<real-extension-id>`
   - `CLERK_AUTHORIZED_PARTIES` = `https://mattgrantforcongress.org,<Amplify app URL>,chrome-extension://<real-extension-id>`
     - Include **every** origin staff load the dashboard from (custom domain **and** the Amplify
       app URL). Omitting one **logs staff out**.
     - Do **not** include the Clerk Frontend-API host (`clerk.mattgrantforcongress.org`) — it is
       not an `azp`.
   - `NEXT_PUBLIC_EXTENSION_STORE_URL` = `<Chrome Web Store listing URL>`
2. **Clerk Dashboard → the instance's allowed origins**: add
   `chrome-extension://<real-extension-id>`, or Clerk rejects the extension's token even with
   `authorizedParties` set.
3. **Redeploy** (env changes need a fresh build so `amplify.yml` re-materializes
   `.env.production`).

`<real-extension-id>` and the Web Store URL come from the published `matt-grant-chrome`
extension — use a **stable** extension id (a `"key"` in its manifest) so the origin never
changes.

## Verify

- **In-app:** `/dashboard/setup` → the **Chrome extension** row flips from "Not set up" to
  "Connected — N staff active in the last 7 days", and the promo card appears on the dashboard
  home.
- **CORS gate (from a shell):**
  ```
  curl -si -H "origin: chrome-extension://<real-extension-id>" \
    https://mattgrantforcongress.org/api/ext/overview | grep -i access-control-allow-origin
  ```
  An allowlisted origin gets `Access-Control-Allow-Origin: chrome-extension://<id>` back; a
  non-allowlisted origin gets none (browser blocks the read). Unauthenticated calls return the
  standard `{ ok:false }` envelope with CORS headers, so a 401/403 with the ACAO header still
  confirms the gate is live.

## Turning it back off

Blank `EXTENSION_ORIGIN` (and/or `CLERK_AUTHORIZED_PARTIES`) and redeploy — the surface
fail-closes again and the rest of the app is unaffected.

_Paid for by Matt Grant for Congress._
