# SMS toll-free texting — go-live & testing runbook

How to take the campaign's text messaging from **staged/no-op** to **live sending** on the toll-free number **+1 844-314-7912**, and the exact end-to-end test to run before the first real blast. This is the one-time setup + verification the campaign does once; day-to-day sending is the **Text blasts** page at Dashboard → **SMS** (composer in `components/dashboard/SmsComposer.tsx`).

> **This is operational + compliance setup, not legal advice.** TCPA consent/quiet-hour rules and FEC disclaimer requirements apply to every send. The message-level rules (opt-in language, the required *Paid for by Matt Grant for Congress.* disclaimer, STOP/HELP handling, quiet hours, cadence) live in [`../../messaging/sms-texting.md`](../../messaging/sms-texting.md) — read it before sending at scale.

---

## ⚠️ Toll-free ≠ A2P 10DLC — don't chase the 10DLC trust score

The campaign sends from a **toll-free** number (**+1 844-314-7912**). Toll-free and A2P 10DLC are **two separate Twilio programs** — do not confuse them:

| | **Toll-free (what we use)** | **A2P 10DLC** |
|---|---|---|
| Applies to | 8xx toll-free numbers | 10-digit **local** numbers |
| Approval gate | **Toll-Free Verification** (must be **Verified**) | Brand + Campaign registration |
| Throughput/deliverability | Set by Toll-Free Verification | Set by the TCR **Trust Score** (MPS + daily cap) |
| Political vetting | **Not required** | **Campaign Verify** (required for 527 committees) |

So the **A2P 10DLC "Trust Score" (e.g. 16/100), the T-Mobile daily-segment cap, Campaign Verify, and the score "appeal" DO NOT apply to our toll-free sends.** If you see a low 10DLC trust score in Trust Hub, it does **not** gate this number — **don't buy Campaign Verify or file a 10DLC appeal for the toll-free program.** A dormant 10DLC brand in the account is harmless; leave it.

**What actually governs toll-free deliverability:** (1) **Toll-Free Verification = Verified**; (2) opted-in-only sending + clear STOP handling (enforced in code); (3) sender identification so it isn't an "unknown sender" (the first 1:1 outbound auto-prepends *"Matt Grant for Congress:"*, and the opt-in flow asks people to **save the number as a contact**); (4) a low spam-report rate. Only revisit the 10DLC path (brand/campaign/Campaign Verify) if the campaign adds a **10-digit local number**.

---

## How it fails safe

Every SMS path checks `smsEnabled()` first (`lib/sms/send.ts`) — true only when **all three** Twilio secrets are present (account SID, auth token, messaging service SID). With any missing:

- `sendSms()` returns `{ sent: false }` and never throws — the app builds and runs normally.
- Dashboard → SMS shows a **"Texting isn't configured yet"** banner and the composer is disabled (you can still draft).
- `/api/sms/test` returns `503 Twilio not configured`; the `sms-drain` cron reports `skipped`.

Loading the three secrets is what flips the campaign live. Two more independent gates stay on regardless:

- **Consent gate (TCPA):** a number is texted **only** when it has an explicit `opted_in` row in the consent ledger (`lib/sms/consent.ts`). Unknown numbers are never texted — including by the test route.
- **Quiet hours (TCPA):** broadcast drains only run **9am–8pm Central** (`withinSendWindow`, `lib/sms/campaigns.ts`); outside that the drain no-ops and resumes next window. (Conservative vs. the 8am–9pm legal window on purpose.)

**You're done when:** the dashboard banner is gone, a `/api/sms/test` send lands on your phone, and STOP/START/HELP replies to the toll-free number behave as described in step 6.

---

## Prerequisites (in Twilio, before touching the app)

1. **Toll-free number purchased** and **+1 844-314-7912** owned by the committee's Twilio account.
2. **Toll-Free Verification = Verified** for that number (Console → Messaging → Regulatory / Toll-Free Verification). This is the political-committee registration, **not** A2P 10DLC. Until it shows **Verified**, carrier sends fail with **error 30032** — see [`CAMPAIGN-ACCOUNTS.md`](../../docs/CAMPAIGN-ACCOUNTS.md) for the submission info and [`../../messaging/sms-texting.md`](../../messaging/sms-texting.md) §1 for the verification content.
3. **Messaging Service created** with the toll-free number **attached** to it. The app sends through the Messaging Service, so you need its **`MG…` SID** — a bare phone number won't work.

---

## 1. Load the Twilio secrets into SSM

Secrets resolve via `getSecret()` (`lib/ssm.ts`): **env-first**, otherwise SSM under the prefix **`/matt-grant/<NAME>`** (override with `SSM_PARAM_PREFIX`). Store them as **SecureString**. The dashboard banner keys off these three:

```bash
REGION=us-east-1

aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /matt-grant/TWILIO_ACCOUNT_SID           --value "ACxxxxxxxx"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /matt-grant/TWILIO_AUTH_TOKEN            --value "xxxxxxxx"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /matt-grant/TWILIO_MESSAGING_SERVICE_SID --value "MGxxxxxxxx"   # the MG… SID, not a number

# Optional — inbound keyword that opts a texter in (case-insensitive). Default: MATT.
# Resolved via getSecret (env-first → SSM), so either this SSM param or an env var works.
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /matt-grant/SMS_OPTIN_KEYWORD            --value "MATT"
```

`CRON_SECRET` is already set (it guards the cron drains and the test route). A fetched value is cached per warm container for `SSM_SECRET_TTL_MS` (default 5 min), so a rotation is picked up within ~5 minutes without a redeploy.

**Local dev:** set the same names as env vars in `.env.local` instead (env always wins) — see `.env.example`.

---

## 2. Point the Twilio inbound webhook at the app

STOP/START/HELP/opt-in keywords are handled by `app/api/webhooks/twilio/route.ts`, which **verifies the `X-Twilio-Signature`** using the auth token from step 1 (an unsigned or wrong-signed request gets `403` — a keyless deploy is inert, not open).

In the **Messaging Service** → **Integration** (or the number's Messaging config), set the inbound handler to:

```
https://YOUR_DOMAIN/api/webhooks/twilio        (HTTP POST)
```

Leave Twilio's **Advanced Opt-Out** on — it auto-replies to STOP/HELP, so the app deliberately does **not** double-reply to those; it still records the opt-out on our side.

---

## 3. Apply the drain cron (queued blasts)

Single test sends go out inline. **Broadcasts** are queued and drained in bounded batches by `/api/cron/sms-drain` (≤30 texts/invocation), which must be on a schedule. Re-run the infra script so the EventBridge rule exists and the app role can read `/matt-grant/*`:

```bash
# from the repo ROOT (the script lives at infra/setup-aws.sh, not web/infra)
BASE_URL=https://YOUR_DOMAIN CRON_SECRET=... infra/setup-aws.sh
```

This installs the **`matt-grant-sms-drain`** rule at `rate(1 minute)` (alongside the email/social drains). The route no-ops during quiet hours, so it's safe to fire around the clock.

---

## 4. Opt your own number in

The consent gate blocks sending to any number without an `opted_in` row — including your test phone. Create one the real way:

- **Text the keyword** (default `MATT`) **to +1 844-314-7912.** The webhook records consent (source `sms-keyword`) and replies with the subscribe confirmation. *(Or check the SMS consent box on the campaign site's join form — same ledger.)*
- Verify it landed: Dashboard → SMS audience counts tick up, or check the `SMSCONSENT` rows.

If you skip this, step 5 returns `409 … is not opted in`.

---

## 5. Smoke-test a single send (`/api/sms/test`)

Fire one real text to your opted-in number. Guarded by the same `CRON_SECRET` bearer as the cron drains:

```bash
curl -sS -X POST https://YOUR_DOMAIN/api/sms/test \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H 'content-type: application/json' \
  -d '{"to":"+1YOURNUMBER","body":"Test from Matt Grant for Congress. Reply STOP to opt out."}'
```

Expect `{"ok":true,"sent":true,"sid":"SM…"}` and the text on your phone within seconds. Common non-200s are in Troubleshooting below.

---

## 6. Verify inbound keyword handling

Reply to the toll-free number from your phone and confirm each transition (check the ledger / Dashboard after each):

| You text | Expected result |
|---|---|
| `STOP` | Marked **opted_out**; the volunteer roster reflects it. (Carrier sends its own STOP confirmation — the app doesn't double-reply.) A subsequent `/api/sms/test` to you now returns **409**. |
| `START` (or `YES`) | Marked **opted_in** again; app replies with the subscribe confirmation. Test send works again. |
| `HELP` | App replies with the campaign info line (candidate + email + STOP notice). |
| `MATT` (the opt-in keyword) | Records consent and replies with the welcome — now leads with a **Get Involved** link. |
| A **CTA keyword** — `DONATE`, `VOLUNTEER`, `EVENTS`, `VOTE` | Records consent (tagged `sms-cta-*`) **and** replies with that action's trackable link + disclaimer. Confirm the link carries `utm_campaign=<keyword>`. Copy/keywords live in `lib/sms/ctas.ts`. |

This exercises signature verification, the consent ledger, roster mirroring, and the reply copy in one pass.

> **CTA keywords** turn the number into the "Text DONATE to +1 844-314-7912" pattern for signs, mailers, and the stump speech — each keyword opts the texter in and drives one action. The UTM tag on every link lets you attribute donations/signups back to the keyword and the material that carried it.

---

## 7. Verify in the dashboard + a live blast

1. Sign in as an **admin** → Dashboard → **SMS** (or the **SMS go-live** page at `/dashboard/sms/go-live`, which shows which of the three Twilio secrets are set and has a one-click test send). The "not configured" banner should be **gone**.
2. Audience counts (Subscribers / Volunteers) reflect opted-in numbers.
3. **Send a test blast to a one-person audience** (your opted-in number): compose from a template, confirm the live preview shows the sender name + *Reply STOP to opt out*, and send. Within a cron cycle (and inside 9am–8pm CT) it should arrive and the campaign row should read `1/1 sent`. Outside quiet hours it stays queued until the window opens — that's expected.
4. Drafting + test sends are open to **captains**; sending to the list is **admins only** (`rbac.ts`).

---

## End-to-end test checklist

```
[ ] Toll-free +1 844-314-7912 shows Verified in Twilio (not Pending/In Review)
[ ] Messaging Service created, number attached, MG… SID in SSM
[ ] TWILIO_ACCOUNT_SID / _AUTH_TOKEN / _MESSAGING_SERVICE_SID in /matt-grant/* (SecureString)
[ ] Inbound webhook → https://YOUR_DOMAIN/api/webhooks/twilio (POST), signature verified
[ ] matt-grant-sms-drain EventBridge rule live (infra/setup-aws.sh ran)
[ ] Own number opted in via keyword; consent row present
[ ] /api/sms/test → 200 {sent:true}; text received
[ ] STOP → opted_out (test send now 409); START → re-subscribed; HELP → info reply
[ ] Dashboard banner gone; audience counts correct
[ ] One-person test blast delivered inside quiet-hours window; row shows 1/1 sent
[ ] Message carries sender ID + "Paid for by Matt Grant for Congress." + STOP  (messaging/sms-texting.md)
```

---

## Troubleshooting

- **`503 Twilio not configured` / banner still shows:** one of the three secrets is missing or unreadable. Re-check the SSM names in step 1 and that step 3 ran so the role can read `/matt-grant/*`. Remember the ~5-min cache TTL after a change.
- **Send fails with carrier error 30032:** the toll-free number isn't Verified yet. Nothing in the app fixes this — finish Toll-Free Verification in Twilio.
- **`401 unauthorized` from `/api/sms/test` or the drain:** wrong/missing `CRON_SECRET` bearer.
- **`409 … is not opted in`:** the recipient has no `opted_in` row. Opt them in via the keyword first (step 4); a number that texted STOP must text START again.
- **Inbound webhook returns `403 invalid signature`:** the stored `TWILIO_AUTH_TOKEN` doesn't match the account whose Messaging Service is calling, or a proxy rewrote the request URL/host used in the HMAC. Confirm the token and that Twilio is hitting the exact public URL.
- **Blast stays "queued" and nothing sends:** it's outside 9am–8pm Central (quiet hours) — it resumes automatically — or the `matt-grant-sms-drain` rule isn't installed (re-run step 3).
- **Delivery/opt-out metrics:** pull from Twilio Messaging Insights; watch STOP rate against the thresholds in [`../../messaging/sms-texting.md`](../../messaging/sms-texting.md) §8.

---

## See also
- [`../../messaging/sms-texting.md`](../../messaging/sms-texting.md) — compliance, consent language, message templates, cadence, metrics.
- [`../../docs/CAMPAIGN-ACCOUNTS.md`](../../docs/CAMPAIGN-ACCOUNTS.md) — Twilio account setup + what to send the developer.
- [`messaging-rbac.md`](./messaging-rbac.md) — who can draft vs. send.
- [`social-go-live.md`](./social-go-live.md) — the companion go-live runbook for social auto-posting.
</content>
</invoke>
