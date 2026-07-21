# Messenger & Instagram Inbox — setup runbook

The campaign's 1:1 inbox for **Facebook Messenger** and **Instagram DMs**, next to the SMS inbox at **`/dashboard/messages`** (Messenger threads live at `/dashboard/messages/social`). Staff read inbound messages and **reply by hand as the campaign Page** — nothing auto-replies. Built to degrade gracefully: the code ships inert until the Meta pieces below are configured, exactly like the SMS webhook without its Twilio token.

## How it works

- **Inbound:** Meta calls `POST ${SITE_URL}/api/webhooks/meta` for every message. The route verifies `X-Hub-Signature-256` against the Meta **app secret**, logs each message to a PSID-keyed conversation (`MSGRCONVO` / `MSGRTHREAD#<platform>:<psid>`), and emails admins/captains on the first unread of a thread. It never replies automatically.
- **Reply:** a staffer replies from the thread; the Send API (`/me/messages` for Messenger, `/<ig-user-id>/messages` for Instagram) posts as the Page, authorized by the same Page token the social publisher uses (`resolveCredentials("facebook")`).
- **Reply window:** Meta only permits a standard reply **within 24 hours** of the person's last message. The thread shows the window and disables the reply box once it closes. (If staff can't always answer within 24h, request the **Human Agent** feature during App Review — it extends the window to 7 days.)

## The launch gate (owner actions — the code can't do these)

1. **Meta App Review for `pages_messaging`** (+ `instagram_manage_messages` for IG DMs). These scopes are already in `META_SCOPES` (`web/lib/social/metaOAuth.ts`); the app must pass review + business verification and leave Development mode. Until then, messaging works only for users with a role on the Meta app.
2. **Re-consent the Page connection** so the stored Page token carries the new messaging scopes (reconnect via `/dashboard/social`), or drop a `FACEBOOK_PAGE_TOKEN` with messaging rights into SSM.
3. **Register the webhook** in the Meta App Dashboard → Webhooks:
   - Callback URL: `https://mattgrantforcongress.org/api/webhooks/meta`
   - Verify token: the value you set in **`MESSENGER_VERIFY_TOKEN`** (SSM `/matt-grant/MESSENGER_VERIFY_TOKEN`).
   - Subscribe the Page to the **`messages`** (and `messaging_postbacks`) fields; for Instagram, subscribe the IG account's `messages`.
4. **No `infra/setup-aws.sh` change** — like Twilio/WinRed, the webhook is registered provider-side. The app secret (`/mattgrant/prod/social/facebook/app_secret`) is already readable at runtime.

## Readiness

The dashboard **Setup & status** page shows a "Messenger & Instagram inbox" row (`live` once the Page token + app secret + verify token are all present). `messengerReadiness()` reports which pieces are present without leaking values. Note it can't see the `pages_messaging` review state — that's account-side.

## Compliance notes

- Human-only replies to people who messaged us first, inside the 24h window = Meta standard messaging (no message tags needed).
- 1:1 solicited replies aren't FEC "public communications," so no per-message disclaimer is required (the P2P reasoning in `federal/digital-advertising.md`); the Page name already identifies the campaign. No STOP/opt-out machinery (that's TCPA/SMS-only) — use **Block** on a thread to stop an abusive sender.
