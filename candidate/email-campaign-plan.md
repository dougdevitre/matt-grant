# Email Campaign Plan — Transactional + Broadcast

One branded email system: every message — automated 1:1 receipts and 1:many blasts — shares the same
red/white/blue identity, logo, imagery, and the required disclaimer + unsubscribe.

## 0. What's built (Phase 1 — live)

- **`web/lib/email/layout.ts`** — the branded HTML shell (table-based, inline styles for Outlook/Gmail/
  Apple Mail): red/white/blue rule, navy header with the white logo, optional hero image, body, a
  bulletproof button, and a footer with the committee address, **"Paid for by…"**, and unsubscribe.
  Plain-text alternative included (`renderText`) for multipart.
- **`web/lib/email/templates.ts`** — 6 templates, copy faithful to `platform.md`:
  - **Transactional:** volunteer welcome, donation thank-you (with amount + FEC notice), contact receipt.
  - **Broadcast:** issue spotlight (pulls any of the 4 issues + its graphic), GOTV reminder, fundraising appeal.
- **`/api/email/preview`** — view any template; static copies on the CDN:
  `https://d5jzyan9wboi3.cloudfront.net/public/email-previews/index.html`

## 1. Email taxonomy

**Transactional (triggered, 1:1 — no marketing consent needed):**
volunteer welcome · donation thank-you/receipt · contact-form receipt · event RSVP confirmation ·
sign-in/security (handled by Clerk) · petition/pledge confirmation.

**Broadcast (1:many — requires consent + unsubscribe):**
issue spotlights (the four priorities) · GOTV series (D-30 → D-1) · fundraising appeals · event invites ·
press/news roundups · endorsement announcements · volunteer mobilization.

## 2. Delivery — AWS SES (AWS-native)

- **Identity:** verify the sending domain (or `mattgrantforcongress.org`) in SES; enable **DKIM** and
  set **SPF**/DMARC so mail authenticates and lands in inboxes. Move out of the SES sandbox for volume.
- **From / reply-to:** `Matt Grant for Congress <info@mattgrantforcongress.org>`, reply-to the campaign inbox.
- **Send:** transactional via SES `SendEmail`; broadcast via SES bulk/templated send to the list.
- **Feedback:** an SES **configuration set** → SNS for bounces/complaints → suppress bad addresses
  automatically (protects sender reputation). Store `SES_FROM`, `SES_CONFIG_SET` in SSM.
- Add `@aws-sdk/client-sesv2` and a thin `web/lib/email/send.ts` wrapper (graceful no-op until configured).

## 3. Subscriber list + unsubscribe

- **DynamoDB** (extend the single table): subscriber items keyed by email — `status`
  (subscribed/unsubscribed/bounced), `source`, `consentAt`, `tags`, and a signed `unsubToken`.
- **`/unsubscribe?token=…`** route flips status instantly; every broadcast injects the recipient's
  `{{unsubscribe_url}}` (the templates already carry the placeholder).
- Import existing contacts (with provenance) only where consent exists.

## 4. Compliance (build it in, not bolt it on)

- **CAN-SPAM:** valid physical address ✓, working unsubscribe honored promptly ✓, accurate
  from/subject lines, no deceptive headers. (All in the shell already.)
- **FEC:** every email carries **"Paid for by the Matt Grant for Congress Committee."** ✓
- **Consent:** broadcast only to opted-in addresses; transactional receipts exempt. Educational, not legal advice.

## 5. Automation / triggers

| Trigger | Email | Wiring |
|---|---|---|
| Contact form submitted | contact receipt (+ internal notify) | `/api/contact` → SES |
| Volunteer opt-in | volunteer welcome | same form, `interest=volunteer` |
| Donation (WinRed) | donation thank-you | WinRed webhook → `/api/webhooks/winred` → SES |
| Scheduled | issue spotlight / GOTV / appeal | EventBridge cron → broadcast send |

## 6. Staff composer (dashboard)

A `/dashboard/emails` page: pick a template, fill variables, live-preview (the `/api/email/preview`
renderer), choose audience/segment, send a **test to yourself**, then send to the list — with a
confirm step and a send log in DynamoDB.

## 7. Phasing

- **P1 — done:** branded shell + 6 templates + CDN preview.
- **P2:** SES identity + `send.ts`; wire the **contact form** → receipt + welcome (first real sends).
- **P3:** subscriber table + `/unsubscribe`; enable broadcast sends to the list.
- **P4:** WinRed donation webhook → thank-you; EventBridge-scheduled GOTV/issue series.
- **P5:** the dashboard composer + send log + simple segments.

_Paid for by the Matt Grant for Congress Committee._
