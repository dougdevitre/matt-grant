# Meta ads — setup, tracking, and running a campaign

How to reach MO-02 voters the campaign **cannot text** (the voter file has no phones; TCPA) with
paid Meta ads, using the hashed Custom Audience export and the site's built-in tracking.

> ⏰ **Timing (Aug 4, 2026 primary):** political-ad **identity verification takes 5–10 business
> days** and Meta enforces a **final-week blackout on *new* political ads**. New ads for the primary
> must be authorized and live before that window — confirm the exact blackout dates. If you're not
> already an authorized political advertiser, set it up now for the general/future.

## 1. Site tracking config (the Meta Pixel) — code is in, activation is one env var

The **Meta Pixel** ships in the app (`components/MetaPixel.tsx`, wired in `app/layout.tsx`) but is
**inert until configured** — exactly like Google Analytics. To turn it on:

1. In Meta **Events Manager**, create/locate your **Pixel (dataset)** and copy its numeric ID.
2. Set `NEXT_PUBLIC_META_PIXEL_ID=<your pixel id>` on the **production** Amplify branch (leave it
   unset on preview branches so their traffic stays out). Redeploy.
3. Accept Meta's Custom Audience / data-processing terms in Business Settings.

What it does once on:
- Fires **PageView** on the public site (not on `/dashboard`).
- The existing CTA events (`track()` in `lib/analytics.ts` — donate/join/Text-MATT clicks) are
  **also** forwarded to the Pixel as custom events, so you can build conversions and optimize
  toward them. GA and the Pixel run independently.
- Runs in **Limited Data Use** mode (CCPA-friendly) since the site has no cookie banner; the Pixel
  is disclosed on `/data-policy`.

> Server-side **Conversions API** (reliable donation/opt-in events from the WinRed + keyword
> webhooks, deduped with the pixel) is a follow-up — ask when you want it. The browser Pixel is
> enough to launch and measure a first campaign.

## 2. Get authorized (one-time, external — skip if done)

1. **Confirm identity** for each ad-team member in Meta Business Manager (mailed code, 5–10 days).
2. **Create the disclaimer** — Business Settings → **Ad Authorizations** → new disclaimer, org name
   exactly as on the FEC filing: **Matt Grant for Congress** (C00945394). Review 24–48h.
3. **Authorize the Facebook Page** (per-Page) and attach the disclaimer. Every political ad is
   public in Meta's **Ad Library for 7 years**.

## 3. Build the audience

```
DYNAMODB_TABLE=matt-grant npx tsx scripts/export-digital-audience.ts --segment BANK,PERSUADE --out top-turnout.csv [--exclude-banked]
```
`BANK` + `PERSUADE` = the highest-likelihood-to-vote cohorts (turnout T≥4). Then Ads Manager →
**Audiences** → Custom Audience → **Customer list** → upload → mark **already hashed** → map
`fn, ln, ct, st, zip, country`. Optionally build a **Lookalike** (Missouri) to extend reach. See
[`digital-audience.md`](./digital-audience.md) for the export details + compliance.

## 4. Create the campaign

- **Objective:** Traffic or Engagement to grow opt-ins/awareness; Leads/Sales for donations.
- **Ad set:** your Custom Audience + a hard **MO-02 / Missouri geo** filter, **18+**; set a budget
  and a schedule that ends before the primary/blackout. The **"Paid for by Matt Grant for
  Congress"** disclaimer auto-attaches from step 2.
- **Creative:** build the image in `/dashboard/studio`; one clear CTA — **"Text MATT to
  844-314-7912 for updates"** (your legal opt-in funnel) and/or **"Vote Aug 4."**
- **Landing URL tracking:** add UTM params, mirroring the site convention —
  `?utm_source=meta&utm_medium=cpc&utm_campaign=gotv`. The WinRed link already carries `sc=` for
  donation attribution.

## 5. Launch + measure

Publish (goes through Meta political-ad review). Watch: **opt-ins** in the **Opt-in growth** panel
on `/dashboard/sms` (ad-driven sign-ups arrive under "Text keyword"), **traffic** in GA/UTM, and
**donations** by `sc` in WinRed. Shift budget to the best segment/creative.

## Compliance checklist
- ✅ Meta political-ad authorization + registered disclaimer
- ✅ "Paid for by Matt Grant for Congress" on every ad (FEC — `federal/digital-advertising.md`)
- ✅ Voter data hashed + political-use-only (RSMo 115.157)
- ✅ Meta Pixel disclosed on `/data-policy`, Limited Data Use on
- ⚠️ Confirm the final-week blackout dates before scheduling
- *Educational information, not legal advice — confirm with compliance counsel.*
