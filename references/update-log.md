# Update Log

Version history and change tracking for the get-elected skill reference files.

---

## Entry Format Template

```
## YYYY-MM-DD -- vX.Y -- Brief Title

**Changes:**
- [added/updated/removed] Description of change
- [added/updated/removed] Description of change

**Verifications Performed:**
- What data was checked or confirmed
- Sources consulted

**Known Gaps:**
- What remains unverified or incomplete

**Files Modified:**
- path/to/file.md
```

---

## 2026-07-23 -- v1.x -- SMS: opt-in growth analytics (by source + trend)

**Context:** Reach is capped by opt-in list size (the voter file can't be texted). The app captures
opt-ins from 12 sources but had no view of which sources convert or how the list is growing — so
there was no way to invest in what works. Adds the measurement layer.

**Changes:**
- [added] `web/lib/reports/optinGrowth.ts` (+ test) — pure `optinGrowth(rows, {now, days})` over the
  consent ledger: totals (opted-in / opted-out / sources), opt-ins by `source` (ranked, %),
  a zero-filled day-bucketed trend (`consentAt`), and recent-window count. `SOURCE_LABELS` maps raw
  tags to friendly names; unknown sources pass through.
- [added] `web/components/dashboard/OptinGrowth.tsx` — dependency-free panel (CSS bars, no chart
  lib): totals, "where opt-ins come from" bars, and a 30-day trend, with an empty-state that names
  the growth levers.
- [updated] `web/app/dashboard/sms/page.tsx` — admin-only `optinGrowth(await listConsent())` rendered
  below Recent sends (one extra consent read, inside the existing admin branch; captains skip it).
- [updated] `web/docs/sms-operator-runbook.md` — "Growing the opt-in list" section.

**Note:** Read-only aggregation of the consent ledger — no send/consent-write/ranking/isolation
change; `optinGrowth` lives in `lib/reports/`, never `lib/sms/`.

**Verifications Performed:**
- `npm run test` — 1930 pass (incl. 8 new `optinGrowth` tests + the `voterfile-isolation` guard);
  `npx tsc --noEmit` clean; `npm run lint` clean; production build succeeds.

**Files Modified:**
- web/lib/reports/optinGrowth.ts (new), web/lib/reports/optinGrowth.test.ts (new)
- web/components/dashboard/OptinGrowth.tsx (new)
- web/app/dashboard/sms/page.tsx, web/docs/sms-operator-runbook.md

---

## 2026-07-23 -- v1.x -- SMS go-live: voter-file → opt-in → scored funnel

**Context:** With ~500k voters loaded but the SMS priority groups reading · 0, the voter-DB vs.
SMS-reach gap looked broken when it's actually the compliant design (the voter file is never
texted; SMS reaches only opted-ins; scores attach only to opted-ins matched by name+ZIP). Makes
that relationship legible.

**Changes:**
- [added] `voterFileCount` to `smsInsightsReadiness()` (`web/lib/reports/smsInsights.ts`) — summed
  from the ~178 precinct rollups already fetched (`listVoterAggs`), the same count
  `districtRollup()` uses; no 500k scan.
- [updated] `web/components/dashboard/SmsInsightsReadiness.tsx` — a headline funnel
  *`<voters> loaded → <opted-in> textable → <scored> scored`* with a caption explaining the two
  drop-offs (TCPA opt-in gate + name+ZIP match), above the existing status rows + Run enrichment now.
- [updated] `web/lib/reports/smsInsights.test.ts` — `voterFileCount` sums agg counts; 0 when empty.
- [updated] `web/docs/sms-operator-runbook.md` — documents the funnel.

**Note:** Running enrichment stays a prod action (the button/cron) — this change only surfaces the
relationship; it doesn't move the numbers.

**Verifications Performed:**
- `npm run test` — 1922 pass (incl. the new funnel assertion + the `voterfile-isolation` guard);
  `npx tsc --noEmit` clean; `npm run lint` clean; production build succeeds.

**Files Modified:**
- web/lib/reports/smsInsights.ts, web/lib/reports/smsInsights.test.ts
- web/components/dashboard/SmsInsightsReadiness.tsx, web/docs/sms-operator-runbook.md

---

## 2026-07-23 -- v1.x -- SMS composer: insight-freshness indicator by the priority dropdown

**Context:** The priority-group dropdown ranks by voter scores, but the composer gave no signal of
how much of the opted-in list is scored or how fresh those scores are — an operator could send an
"insight-driven" blast on stale/sparse data unknowingly. This surfaces that, with a one-click path
to refresh.

**Changes:**
- [added] `web/lib/relativeTime.ts` (+ test) — `relTime()` (server-safe, now-injectable) extracted
  from the go-live panel, plus `isStale()`. `SmsInsightsReadiness.tsx` now imports it (de-duped).
- [updated] `web/app/dashboard/sms/page.tsx` — fetches `smsInsightsReadiness()` (admin only) and
  passes `insight={ scoredPct, lastEnrichedLabel, stale }` to the composer; the timestamp is
  formatted on the server so the client component stays hydration-safe.
- [updated] `web/components/dashboard/SmsComposer.tsx` — under the priority dropdown, a freshness
  line: *"N% of opted-ins scored · voter scores updated <time> · Refresh →"*, tinting *(may be
  stale)* when scores are >~2 days old; the empty-state hint now links to the go-live **Run
  enrichment now** button instead of only naming the CLI.
- [updated] `web/docs/sms-operator-runbook.md` — documents the freshness line.

**Verifications Performed:**
- `npm run test` — 1921 pass (incl. 9 new `relativeTime` tests + the `voterfile-isolation` guard);
  `npx tsc --noEmit` clean; `npm run lint` clean; production build succeeds.

**Files Modified:**
- web/lib/relativeTime.ts (new), web/lib/relativeTime.test.ts (new)
- web/components/dashboard/SmsInsightsReadiness.tsx, web/components/dashboard/SmsComposer.tsx
- web/app/dashboard/sms/page.tsx, web/docs/sms-operator-runbook.md

---

## 2026-07-23 -- v1.x -- SMS go-live: one-click "Run enrichment now" button

**Context:** The composer's priority-group dropdown stays disabled (all groups · 0) until the
opted-in ledger carries voter-score tags. Enrichment previously needed the CLI or the nightly
cron; this adds a dashboard button so staff can re-tag on demand once the voter file is loaded.

**Changes:**
- [added] `runEnrichmentNow()` server action in `web/app/dashboard/sms/go-live/actions.ts` —
  admin-gated (`manageTeam`), calls the shared `runSmsEnrichment()`, revalidates
  `/dashboard/sms/go-live` + `/dashboard/sms`, returns a counts-only summary.
- [added] `web/components/dashboard/RunEnrichmentButton.tsx` (mirrors `GoLiveTestSend`), rendered
  in the *Insight data* panel (`SmsInsightsReadiness.tsx`), disabled until the voter file is
  ingested (enrichment has nothing to tag without it).
- [updated] `web/app/dashboard/sms/go-live/actions.test.ts` — admin success, non-admin rejection,
  and error-path coverage for the new action.
- [updated] `web/docs/sms-operator-runbook.md` — the button as the no-CLI way to re-tag.

**Note:** This only automates the *enrichment* step. The one-time voter-file ingest
(`scripts/ingest-voters.ts --from-s3`) remains an operator/CLI step (large PII files in private
S3), and the scored ceiling is still bounded by opt-in-list growth + name+ZIP match rate.

**Verifications Performed:**
- `npm run test` — 1912 pass (incl. 3 new action tests + the `voterfile-isolation` guard);
  `npx tsc --noEmit` clean; `npm run lint` clean; production build succeeds.

**Files Modified:**
- web/app/dashboard/sms/go-live/actions.ts, web/app/dashboard/sms/go-live/actions.test.ts
- web/components/dashboard/RunEnrichmentButton.tsx (new)
- web/components/dashboard/SmsInsightsReadiness.tsx
- web/docs/sms-operator-runbook.md

---

## 2026-07-23 -- v1.x -- SMS go-live readiness: auto-enrichment cron, insights panel, throughput/ETA

**Context:** Assessment of whether the campaign can send insight-driven SMS blasts today. Finding:
no engineering blocks it — sending is gated on operational setup (Twilio Toll-Free Verification,
3 SSM secrets, running `infra/setup-aws.sh`, loading the voter file + running enrichment). Added
three engineering enhancements so delivery is more automated and transparent.

**Changes:**
- [added] **Auto-run enrichment (Enhancement A).** Extracted the enrichment orchestration into
  `web/lib/reports/smsEnrichmentRun.ts` (`runSmsEnrichment`), refactored
  `web/scripts/enrich-sms-audience.ts` to a thin CLI wrapper, added
  `web/app/api/cron/sms-enrich/route.ts` (bearer-gated, counts-only), and a nightly
  `matt-grant-sms-enrich` EventBridge rule (`cron(0 8 * * ? *)`) in `infra/setup-aws.sh`. Keeps
  segments/`banked` fresh during GOTV without a manual run. Reads voter data only from
  `lib/reports/` — never `lib/sms/` (isolation wall intact).
- [added] **Insights-readiness panel (Enhancement B).** `smsInsightsReadiness()` in
  `web/lib/reports/smsInsights.ts` (voter file loaded? last enrich time? % of opted-ins scored?),
  surfaced as a panel on `/dashboard/sms/go-live` via `components/dashboard/SmsInsightsReadiness.tsx`
  so staff know whether the priority presets reflect real voters.
- [added] **Throughput knobs + completion ETA (Enhancement C).** `web/lib/sms/pacing.ts` centralizes
  env-configurable `SMS_DRAIN_BATCH` / `SMS_DRAIN_BATCHES_PER_RUN` (bounded) and a window-aware
  `estimateDrainCompletion()` / `formatEtaCT()`. The send confirmation and the Recent-sends list
  now show when a large blast finishes (respecting 9am–8pm CT quiet hours).
- [updated] `web/docs/sms-operator-runbook.md` — nightly enrichment, ETA, throughput knobs.

**Verifications Performed:**
- `npm run test` — 197 SMS/reports tests pass, incl. new `lib/reports/smsInsights.test.ts` and
  `lib/sms/pacing.test.ts`, and the `audiences.voterfile-isolation.test.ts` guard stays green
  (the new cron/enrichment/insights code reads voter data only from `lib/reports/` + cron routes).
- `npx tsc --noEmit` clean; `npm run lint` clean (no new warnings); production build succeeds.

**Known Gaps:**
- The go-live runbook itself (Twilio verification, SSM secrets, voter ingest, first enrich) is
  operational and unchanged — see `web/docs/sms-go-live.md`.

**Files Modified:**
- web/lib/reports/smsEnrichmentRun.ts (new), web/scripts/enrich-sms-audience.ts
- web/app/api/cron/sms-enrich/route.ts (new), infra/setup-aws.sh
- web/lib/reports/smsInsights.ts (new), web/lib/reports/smsInsights.test.ts (new)
- web/components/dashboard/SmsInsightsReadiness.tsx (new), web/app/dashboard/sms/go-live/page.tsx
- web/lib/sms/pacing.ts (new), web/lib/sms/pacing.test.ts (new)
- web/lib/sms/campaigns.ts, web/app/api/cron/sms-drain/route.ts
- web/app/dashboard/sms/actions.ts, web/app/dashboard/sms/page.tsx
- web/docs/sms-operator-runbook.md

---

## 2026-07-23 -- v1.x -- SMS composer: voter-priority preset dropdown + inline budget

**Changes:**
- [added] `SMS_PRIORITY_PRESETS` + `presetTokens()` in `web/lib/sms/audiences.ts` — likelihood-ordered
  presets over the voter segments (All opted-in, GOTV core / MOBILIZE, Top priority / MOBILIZE+BANK,
  Supporters+persuadable, BANK, PERSUADE, PROSPECT, GOTV chase). Each expands to the existing
  `segment:`/`outstanding` target tokens, so the resolver, counts, and validation need no new grammar.
  Voter-free by construction (plain strings, no `lib/voters` import — the TCPA isolation guard).
- [updated] `web/components/dashboard/SmsComposer.tsx` — surfaces the presets as a first-class
  **"Who to reach — by likelihood to vote"** dropdown (shown always; disabled/zero empty state before
  `npm run enrich:sms` has tagged anyone), and adds an inline **Budget $** field that computes the
  "Max texts" cap live (via `spendModel`) and reports how far the money reaches ("top N%, down through
  <segment>"). Budget overrides the manual cap. Voter segments moved out of the "narrow by county /
  voter tag" chips into this dropdown.
- [updated] `web/app/dashboard/sms/page.tsx` — passes `priorityPresets`, `optedIn`, and per-segment
  `segmentCounts` to the composer (derived from the already-fetched `smsTargetCounts()`; no new query).
- [added] `SMS_PRICING_DEFAULTS` in `web/lib/reports/smsSpend.ts`, shared by the composer and the Spend
  Decider page so the Twilio planning rates can't drift.
- [updated] Docs: `web/docs/sms-operator-runbook.md` (audience + budget steps),
  `candidate/sms-targeting-plan.md` (Phase 6).

**Verifications Performed:**
- `npm run test` — 186 SMS/reports tests pass, incl. new `web/lib/sms/priorityPresets.test.ts` (presets
  expand only to `parseTargetToken`-valid tokens, MOBILIZE-first order, never MONITOR) and the
  `audiences.voterfile-isolation.test.ts` guard (proves no new `lib/sms → lib/voters` edge).
- `npx tsc --noEmit` clean; `npm run lint` clean (no new warnings).

**Known Gaps:**
- Preset reach counts are per-group opted-in sums; actual sends depend on group/role selection and
  de-dupe (labeled "before de-dupe and filters"). Real per-segment response weights remain Phase 5.

**Files Modified:**
- web/lib/sms/audiences.ts
- web/lib/reports/smsSpend.ts
- web/components/dashboard/SmsComposer.tsx
- web/components/dashboard/SmsSpendDecider.tsx
- web/app/dashboard/sms/page.tsx
- web/lib/sms/priorityPresets.test.ts (new)
- web/docs/sms-operator-runbook.md
- candidate/sms-targeting-plan.md

---

## 2026-07-21 -- v1.x -- Runbook: TikTok, YouTube, and Threads auto-posting setup

**Changes:**
- [updated] `web/docs/social-go-live.md` now documents the three platforms whose publish adapters
  ship but weren't in the runbook: **TikTok** (OAuth `client_key`/`client_secret`, `video.publish`
  scope, domain verification, `SELF_ONLY` until the content-posting audit), **YouTube** (`client_id`,
  `youtube.upload`+`readonly`, `private` until Google app verification), and **Threads** (manual
  token — no OAuth connect yet — via `THREADS_ACCESS_TOKEN` + `THREADS_USER_ID`). Adds the SSM
  credential blocks, a new §6 on the audit/verification/token gates + the manual-token shortcut, and
  troubleshooting bullets. All grounded in the actual secret names + scopes in
  `lib/social/oauth/{tiktok,youtube}.ts` and `publish.ts`.

**Files Modified:**
- web/docs/social-go-live.md

---

## 2026-07-21 -- v1.x -- /social: auto-size each channel's share graphic

**Changes:**
- [added] The per-channel **"Post to [platform]"** buttons now attach the graphic **sized for that
  platform** (X → landscape, Instagram/Facebook → square, TikTok/Story → 9:16, LinkedIn → banner),
  driven by the existing `CHANNELS[c].imageFormat` map (previously unused). `GraphicPicker` reports
  its `{format,theme,photo}` up (`onChange`); the hero share still uses the on-screen image, while
  each channel row builds its own `graphicSrc({ format: spec.imageFormat, theme, photo, headline })`.
- [added] Invariant test (`channels.test.ts`): every channel's `imageFormat` is a real
  `/api/graphics` format, so the auto-sized image can never 404.
- [added] Feedback on each **"Post to [platform]"** click — an `aria-live` note confirms the
  caption was copied and the image saved, and tells the user to paste/attach on the channels
  where that's manual (Instagram/TikTok/YouTube).

**Files Modified:**
- web/components/site/{GraphicPicker,SocialToolkit,PostChannelCard}.tsx, web/lib/social/channels.test.ts

---

## 2026-07-21 -- v1.x -- One-tap "Share with image" on /social

**Changes:**
- [added] `web/lib/social/nativeShare.ts` (+ test) — Web Share API helpers: `canShareFiles()`,
  `shareImageFile()` (native share sheet with the graphic **and** caption pre-loaded on mobile;
  falls back to copy-caption + download-image elsewhere), and `postToChannel()` (opens a channel +
  copies caption + saves image). Fires `track("share_click", …)`.
- [added] Hero **"Share this post + image"** button in the `/social` detail panel
  (`web/components/site/SocialToolkit.tsx`) — one tap opens the phone's share sheet with the current
  graphic + full caption (disclaimer included); the image is pre-fetched into a `File` so the share
  fires inside the click's activation. Per-channel buttons became **"Post to [platform]"**
  (`PostChannelCard.tsx`) — open the channel + copy the caption + save the image in one click (the
  big win for Instagram/TikTok/YouTube, which can't web-prefill).
- [added] `web/lib/social/graphicUrl.ts` — `graphicSrc()` shared by `GraphicPicker` (now reports its
  `src` up via `onSrcChange`) and the share actions, so every share uses exactly the graphic on screen.

**Verifications Performed:**
- `nativeShare.test.ts` covers the feature-detect + native-share + fallback paths; full gauntlet
  green (tsc, vitest, lint, compliance, build + bundle guard, chromium a11y for /social). Both share
  payload halves carry "Paid for by…" (text via renderChannelText, image baked by /api/graphics).

**Known Gaps:**
- File sharing (image in the share sheet) is a mobile-browser capability; desktop uses the
  copy-caption + download-image fallback. The native share sheet is channel-agnostic (the app is
  chosen in the OS sheet) — per-channel targeting with an image isn't possible on the web.

**Files Modified:**
- web/lib/social/nativeShare.ts (+ test), web/lib/social/graphicUrl.ts
- web/components/site/{SocialToolkit,PostChannelCard,GraphicPicker}.tsx

---

## 2026-07-21 -- v1.x -- Harden the image generator: self-hosted fonts + render smoke tests

**Changes:**
- [added] Self-host the image fonts — `web/public/fonts/fraunces-700.woff` + `public-sans-600.woff`
  (WOFF v1; satori can't decode woff2) with a loader `web/lib/fonts/brandFonts.ts` (+ test) that
  reads them from disk, memoized. `web/lib/og.tsx` (`renderOgCard`) and `web/app/api/graphics/route.tsx`
  now load fonts locally instead of fetching Google Fonts at request time, so a Google Fonts outage
  can no longer silently downgrade the brand typeface — or the "Paid for by" disclaimer's look — on
  any generated card. The network fetch survives only as a read-failure fallback (extracted to
  `web/lib/googleFont.ts` to avoid an import cycle). Files live under `public/` so Next's standalone
  output ships them. Fixes a latent 500 risk too: satori rejects woff2, which Google can serve.
- [added] First coverage of the satori RENDER path: `web/e2e/graphics.spec.ts` (Playwright) asserts
  `GET /api/graphics` returns a valid PNG for every format/theme incl. empty + very long headlines —
  runs in CI via the existing `test:a11y` (`playwright test`) job; and `brandFonts.test.ts` proves
  the local fonts load without network.

**Verifications Performed:**
- Full gauntlet green — tsc, vitest (1,886), lint, compliance, build + bundle guard (the ~40KB woff
  don't affect the compute budget) — plus the new Playwright render gate (7 passing). Visually
  confirmed the headline still renders in Fraunces from the local file (not the fallback).

**Files Modified:**
- web/public/fonts/*.woff, web/lib/fonts/{brandFonts.ts,brandFonts.test.ts,README.md}, web/lib/googleFont.ts
- web/lib/og.tsx, web/app/api/graphics/route.tsx, web/e2e/graphics.spec.ts

---

## 2026-07-21 -- v1.x -- Pro-grade /social image generator + one-tap "post to channel"

**Changes:**
- [added] `web/lib/social/graphicLayout.ts` (+ test) — pure layout engine for the image generator.
  A **per-glyph advance table** calibrated to Fraunces 700 measures line widths honestly (a flat
  average badly under-sized caps/`m`/`w`), `fitHeadline` steps the headline down until the
  MEASURED text fits the card's real box, and `balanceLines` evens the wrap. Per-format geometry
  (`layoutFor`) + composition family (`familyOf`) reserve an accurate disclaimer band. Replaces the
  old 5-bucket `headline.length` guess — text now fills each card with even margins at any length.
- [updated] `web/app/api/graphics/route.tsx` fully reworked: real type (**Fraunces 700** headline +
  **Public Sans 600** labels via the shared `googleFont` loader, graceful fallback); a
  **red/white/blue** palette with a **red ground default** (Red / Navy / White) and a tri-color
  rule; and a robust **per-family composition** — portrait & square STACK (photo top, headline
  centered), wide keeps text-left/photo-right — fixing the old sideways-band/overflow bug. Lines
  render `white-space: nowrap` so satori can't re-wrap a fitted line. Params/formats unchanged;
  route stays public + rate-limited; the "Paid for by" line is on every image.
- [updated] `GraphicPicker.tsx` + `StudioForm.tsx` theme pickers → Red / Navy / White, default Red.
- [added] Per-channel **"Open [platform]"** buttons on /social (`channelPostUrl` in `sharePost.ts`,
  + test; buttons in `PostChannelCard.tsx`) — deep-link to each platform's posting surface
  (prefilled text for X/Threads, link-share for Facebook/LinkedIn, upload page for
  Instagram/TikTok/YouTube). Flow: copy → open → paste → attach graphic → post. Red/white/blue
  brand rule added to the `/social` page.

**Verifications Performed:**
- `graphicLayout.test.ts` proves the MEASURED longest line ≤ box on every format for many headline
  lengths; `sharePost.test.ts` covers the deep links. **Visual review**: rendered every format ×
  theme × short/medium/long via a dev server and confirmed even margins, balanced lines, zero
  overflow/overlap, and a cohesive red/white/blue look. Full gauntlet green.

**Known Gaps:**
- Google Fonts fetch may be proxy-blocked in some sandboxes (falls back to the default font);
  real Fraunces rendering is exercised in the deployed env, like the existing OG cards.

**Files Modified:**
- web/lib/social/graphicLayout.ts (+ test), web/app/api/graphics/route.tsx, web/lib/og.tsx
- web/lib/social/sharePost.ts (+ test), web/components/site/PostChannelCard.tsx
- web/components/site/GraphicPicker.tsx, web/components/dashboard/StudioForm.tsx
- web/components/site/SocialToolkit.tsx, web/app/(site)/social/page.tsx

---

## 2026-07-21 -- v1.x -- Public /social page: self-serve "share the campaign" toolkit

**Changes:**
- [added] Public page `web/app/(site)/social/page.tsx` (+ `web/components/site/SocialToolkit.tsx`,
  `PostChannelCard.tsx`, `GraphicPicker.tsx`) — anyone can browse the approved 50-post library
  (filter by issue/audience/goal) and, for any post, get copy-ready text fitted to all seven
  channels with the "Paid for by" disclaimer baked in, plus a downloadable branded graphic and
  X/Facebook share links. No login; approved-content-only (no free-text authoring).
- [added] `web/lib/social/sharePost.ts` (+ test) — maps a library `SocialPost` onto the pure
  `renderChannelText` renderer with a CTA→public-URL map; the test proves every catalog post
  renders on all 7 channels within limits and always keeps the disclaimer.
- [added] 18 evergreen shareables (`EVERGREEN_POSTS` in `web/lib/socialPosts.ts`, `day: 0`, new
  `SHAREABLE_POSTS` = countdown + evergreen) so /social has a deeper, audience-varied catalog
  (68 posts). Faithful to `platform.md` — no new positions/stats/quotes. The dashboard scheduler
  still uses the dated `SOCIAL_POSTS` countdown alone, so its behavior is unchanged.
- [updated] Surfaced `/social` in the nav ("Get Involved"), `sitemap.ts`, and the a11y scan
  (`e2e/a11y.spec.ts`). Reuses the existing public, rate-limited `/api/graphics` endpoint.

**Verifications Performed:**
- Full gauntlet (tsc, vitest incl. the new sharePost test, lint, compliance, build + bundle guard,
  chromium axe now covering `/social`). No new public capability beyond the friendly UI — the
  graphics endpoint was already public.

**Known Gaps:**
- Graphic headline is derived from the selected approved post (not free text) by design, so
  supporters can't put arbitrary copy on the campaign brand.

**Files Modified:**
- web/app/(site)/social/page.tsx, web/components/site/{SocialToolkit,PostChannelCard,GraphicPicker}.tsx
- web/lib/social/sharePost.ts, web/lib/social/sharePost.test.ts
- web/lib/site.ts (NAV), web/app/sitemap.ts, web/e2e/a11y.spec.ts

---

## 2026-07-21 -- v1.x -- Multi-channel voter outreach: SMS vote agent, social precise text, Messenger/IG inbox, GOTV early-vote email

**Changes:**
- [added] SMS conversational **vote agent** — county/ZIP-aware replies with a calendar-tracking
  early-vote phrase, plus geo/segment enrichment of the consent ledger and a send-path priority
  ranking that orders higher-likelihood voters first (MOBILIZE > BANK > PERSUADE > PROSPECT),
  never dropping unscored recipients (`web/lib/sms/votebot.ts`, `web/lib/sms/geo.ts`,
  `web/lib/reports/smsTargeting.ts`, `web/lib/reports/smsEnrichment.ts`).
- [added] Admin-gated **SMS Spend Decider** page — interactive Twilio-pricing/segment-cap
  planner in the dashboard (`web/app/dashboard/sms/spend/`, gate `sendSms`).
- [added] Social **precise per-channel paste-ready text** (`renderChannelText`) and an
  extension queue/posted API so staff copy exactly what each platform will publish
  (`web/lib/social/channels.ts`, `/api/ext/social/*`).
- [updated] Compliance fix: TikTok caption cap corrected (4000→2200) so the FEC disclaimer
  is never sliced off; added tests for the two ext social routes.
- [added] Facebook **Messenger + Instagram DM** human-only inbox — signed webhook, 24h-window
  aware, no auto-send (`web/app/api/webhooks/meta/`, `web/lib/messenger/*`,
  `/dashboard/messages/social`).
- [added] GOTV **early-vote EMAIL** mirroring the SMS pushes, sharing one date source
  (`web/lib/electionDates.ts`) so the two channels can't drift; closed compliance-audit **E-1**
  with a broadcast-level unsubscribe-substitution test.

**Verifications Performed:**
- Each change shipped through the full CI gauntlet (tsc, vitest, lint, `npm run compliance`,
  build + bundle guard, chromium a11y). The voter-file TCPA isolation guard
  (`web/lib/sms/audiences.voterfile-isolation.test.ts`) stayed green — no `lib/sms/` module
  reads voter partitions; voter-file numbers are never broadcast-texted.

**Known Gaps:**
- All channels remain inert behind readiness gates + Matt's approval hold. Go-live still waits
  on human/operational steps: SES verification, Twilio Toll-Free Verification, Meta App Review
  (`pages_messaging` / `instagram_manage_messages`), and the prod `infra/setup-aws.sh` run.

**Files Modified:**
- web/lib/sms/votebot.ts, web/lib/sms/geo.ts, web/lib/sms/templates.ts
- web/lib/reports/smsTargeting.ts, web/lib/reports/smsEnrichment.ts, web/scripts/enrich-sms-audience.ts
- web/lib/reports/smsSpend.ts, web/components/dashboard/SmsSpendDecider.tsx, web/app/dashboard/sms/spend/page.tsx
- web/lib/social/channels.ts, web/app/api/ext/social/*
- web/app/api/webhooks/meta/route.ts, web/lib/messenger/*, web/app/dashboard/messages/social/*
- web/lib/electionDates.ts, web/lib/email/templates.ts, web/lib/email/broadcasts.ts, web/lib/email/campaignSend.test.ts

---

## 2026-07-16 -- v1.x -- Low-risk follow-ups: ingest hardening, runbook, donation primitives

**Changes:**
- [added] `docs/RUNBOOK-voter-ingest-and-twilio-fund.md` — step-by-step for the first real voter ingest
  (dry-run → live → reconcile) and for regenerating the real Twilio-fund numbers.
- [updated] Low-memory ingest (`web/scripts/ingest-voters-lowmem.ts`) now validates the header/columns
  (same fail-loud gate as the stock script, `--skip-header-check` override); regenerated the committed
  `web/scripts/loadvoters.cjs` bundle.
- [added] Opt-in `--reconcile` on `web/scripts/ingest-voters.ts` — reports departed voters (in a prior
  load, absent now) via `reconcileStale`; default-off, reported never auto-deleted.
- [added] Per-tier shareable WinRed links (`sc=sms-tier`) as copy/paste snippets in
  `messaging/sms-texting.md` §3 + the sc-map row in `candidate/donor-value-ladder.md`; a unit test binds
  those doc links to `donateHref` output so they can't drift.
- [added] Optional `recurring` param on `donateHref` (`web/lib/donorLadder.ts`) — additive, default-off,
  byte-identical unless explicitly passed; the primitive for a future opt-in "make it monthly" control
  (the live toggle itself is deferred pending review, compliance-audit A-8).

**Verifications Performed:**
- `web` suite green; `tsc`/`eslint`/`compliance` clean. Bad-header rejection verified on both the `.ts`
  and the regenerated `.cjs` (exit 1 before any AWS call); good header passes.

**Known Gaps:**
- `--reconcile`, `--from-s3`, and live writes are verified offline only (pure helpers unit-tested); the
  AWS round-trips are exercised by the runbook, not this change. `--reconcile` is stock-path only (memory).
- The real Twilio-fund numbers and the first live ingest still require an AWS run (the runbook covers them).

**Files Modified:**
- docs/RUNBOOK-voter-ingest-and-twilio-fund.md, docs/VOTER-FILE.md
- web/scripts/ingest-voters.ts, web/scripts/ingest-voters-lowmem.ts, web/scripts/loadvoters.cjs
- web/lib/donorLadder.ts, web/lib/donorLadder.test.ts
- messaging/sms-texting.md, candidate/donor-value-ladder.md

---

## 2026-07-15 -- v1.x -- Donation packages, voter-record use, seeding & the Twilio-fund report

**Changes:**
- [updated] Donation packages unified so `/donate` is the canonical public URL: the amount
  picker now DERIVES from the donor `LADDER` (single source, `web/lib/donorLadder.ts`
  `quickPickAmounts()`), a shareable `#packages` anchor was added, and the docs
  (`candidate/donor-value-ladder.md`, `messaging/email-fundraising.md`) reference the same rungs.
- [added] Voter-record **usage & lineage** map (`candidate/voter-file-plan.md` §7): every consumer,
  its fields/granularity/output, and governing rule — plus a code-enforced TCPA wall
  (`web/lib/sms/audiences.voterfile-isolation.test.ts`) that fails the build if any voter-file
  surface leaks into the SMS recipient path.
- [added] Synthetic-voter dev seed (`web/scripts/seed-voters-sample.ts`) so the voter dashboard,
  SMS composer, and the Twilio-fund report render offline without real PII.
- [added] Twilio-fund decision brief (`candidate/twilio-fund-plan.md`) + pure analysis lib
  (`web/lib/reports/twilioFund.ts`) + read-only generator (`web/scripts/twilio-fund-report.ts`):
  optimizes the SMS budget over the opted-in audience joined to voter scores; the voter file is
  never texted. Registered the `/twiliofund` command and a SKILL.md routing row.
- [updated] Voter ingest hardened (`web/scripts/ingest-voters.ts`): header/column validation,
  SHA-256 whole-run idempotency (`--force`), `--from-s3` fetch, and count reconciliation
  (`web/lib/voters/ingestPlan.ts`, `parse.ts` `validateHeader`).

**Verifications Performed:**
- `web` unit suite: 1757 passing (added donorLadder, isolation-guard, seed-shared, twilioFund,
  ingestPlan, and header-validation tests); `tsc --noEmit` and `eslint` clean.
- Seed + report pipelines exercised offline against synthetic data; ingest dry-run verified on a
  synthetic xlsx (valid header reconciles; a scrambled header exits non-zero; `--skip-header-check`
  overrides).

**Known Gaps:**
- All dollar/count figures in `twilio-fund-plan.md` are illustrative placeholders; regenerate live
  numbers with `web/scripts/twilio-fund-report.ts` against the real table.
- `--from-s3` fetch and live DynamoDB writes were not exercised against AWS in this change (offline
  environment); the pure logic they call is unit-tested.

**Files Modified:**
- web/lib/donorLadder.ts, web/components/budget/DonationImpact.tsx, web/components/DonorLadder.tsx, web/app/(site)/donate/page.tsx
- candidate/donor-value-ladder.md, messaging/email-fundraising.md
- candidate/voter-file-plan.md, SKILL.md, commands/commands.md
- web/lib/sms/audiences.voterfile-isolation.test.ts
- web/scripts/seed-voters-sample.ts, web/scripts/seed-constants.ts, web/scripts/seed-shared.ts, web/scripts/seed-dynamo.ts
- candidate/twilio-fund-plan.md, web/lib/reports/twilioFund.ts, web/scripts/twilio-fund-report.ts
- web/lib/voters/ingestPlan.ts, web/lib/voters/parse.ts, web/scripts/ingest-voters.ts

---

## 2026-07-11 -- v1.x -- Voter xlsx purged from git history (custody §2.1 resolved)

**Changes:**
- [removed] The five MO02_VotersList xlsx (577k voters' PII) purged from ALL git history:
  owner-run `git-filter-repo --invert-paths` on a mirror clone (both path variants --
  four files under docs/, Part 5 at the repo root) + coordinated force-push. Every branch
  rewritten in place; no branch deleted; main's tree content unchanged (new commit ids).
- [updated] `candidate/voter-file-plan.md` §2.1: the Phase-0 "open decision" is resolved;
  residual owner actions documented (re-clone all other clones; GitHub Support request
  for server-side cache/PR-ref removal).

**Verifications Performed:**
- Pre-push: `git rev-list --all --objects | grep -c MO02_VotersList` = 0 in the rewritten
  mirror. Post-push: 0 across all remote refs from a fresh fetch; voters test suite green
  on the new history; a full pre-purge bundle backup retained by the owner. S3 copies
  (the canonical data) untouched.

**Known Gaps:**
- GitHub-side dangling copies persist until the owner's Support request / GC (repo is
  private, so exposure is bounded to collaborators meanwhile).

**Files Modified:**
- candidate/voter-file-plan.md (git history itself rewritten out-of-band by the owner)

---

## 2026-07-11 -- v1.x -- Early-vote map mode: banked returns on the 3D map

**Changes:**
- [added] "Early vote" mode on /dashboard/map: shade = ballots returned as a share of the
  §4 heuristic expected primary vote (denominator declared on the legend), column height
  = ballots banked. The precincts route joins BALLOTAGG banked counts through the same
  crosswalk as the voter enrichment (split precincts summed) and stamps banked +
  bankedShare per feature; meta.voterJoin reports the banked total. The mode stays
  DISABLED until returns actually import (own availability check, like the voter mode
  pre-ingest); pre-returns the map is byte-identical.
- The data-and-map plan's early-vote visualization: the live-current-state mode is now
  shipped; the animating time-slider remains a future item (noted).

**Verifications Performed:**
- Unit: BALLOTAGG join sums banked across split precincts and ignores unmatched rows;
  earlyVote paint expressions (color reads bankedShare, height scales banked by
  maxBanked, legend cites the heuristic denominator + the Jul 21-Aug 3 window). Full
  typecheck/lint/test/build pass.

**Known Gaps:**
- Time-slider animation of returns (future); the mode shows current state only.

**Files Modified:**
- web/lib/voters/enrich.ts (+ test), web/app/api/geo/precincts/route.ts,
  web/lib/viz/precinctPaint.ts (+ test), web/components/MapExplorer.tsx,
  candidate/data-and-map-plan.md

---

## 2026-07-11 -- v1.x -- Gap pass: chase-tier reconciliation, bulk canvass paste, doc drift

**Changes:**
- [fixed] REAL BUG: banked-per-tier counters (BALLOTAGG) were frozen at bank-time segment
  while canvass IDs later moved the universe tiers -- the chase board could show negative
  Outstanding / >100%. The canvass write-back now reconciles: pure `tierShift` (chase.ts,
  tested) computes the move; `applyTierShift` (returnsStore) decrements the old tier,
  increments the new, and restamps the return row's segment/t so repeated changes
  reconcile from current state. Flat banked totals never change; the save message reports
  "N banked ballots re-tiered".
- [added] The bulk canvass paste UI ("Paste IDs from a returned sheet") -- the server
  action existed but was unwired; per-row selects only render the first 500 rows, so bulk
  entry matters for big precincts.
- [updated] Voters page HowTo (canvass write-back steps, banked hiding, Airtable count
  sync, accurate phone sentence incl. vendor append); data-and-map-plan (early-vote feed
  integration marked SHIPPED -> chase board; Voter-file map mode added to the shipped
  note; time-slider = still-future widget, data live); voter-file-plan §4 (PROSPECT added
  to the segment list, canonical-definitions citation fixed to score.ts, chase-tier line
  gains the shipped pointer); voters_mailing.py docstring (export with banked hidden).

**Verifications Performed:**
- Two read-only audit agents swept merged main (#355-#360): rbac consistent, banked
  filtering reaches every print/export path, all cross-refs resolve, update-log complete.
  New tierShift unit tests (cross-tier, into/out of non-chase, no-move). Full
  typecheck/lint/test/build pass.

**Known Gaps:**
- Pre-existing BALLOTAGG rows written before this fix are not retro-reconciled (no data
  exists yet -- the live ingest hasn't run, so nothing to migrate).

**Files Modified:**
- web/lib/voters/{chase,returnsStore,canvassStore}.ts (+ chase test),
  web/app/dashboard/voters/{actions.ts,page.tsx},
  web/components/dashboard/VotersExplorer.tsx, candidate/{voter-file-plan,data-and-map-plan}.md,
  tools/pdf-letterhead/voters_mailing.py

---

## 2026-07-11 -- v1.x -- Banked voters come off the outreach lists

**Changes:**
- [added] `listReturnsByPrecinct` (returnsStore) + `excludeBanked` (dashboard, pure,
  tested): the precinct drill-down now loads the shard's banked ballots and HIDES them
  from lists by default -- tactics/ballot-chase-program.md's rule (mark banked AND remove
  from contact lists). Walk packets, call sheets, canvass entry, and every CSV export
  operate on the filtered list automatically.
- [added] "Hide banked (N)" toggle (default ON) for a deliberate include -- visible voted
  rows carry a dated badge; a reprint nudge flags packets printed before the last import.
- Pre-returns the behavior is byte-identical (empty banked map -> toggle hidden).

**Verifications Performed:**
- Unit: excludeBanked truth table (hide drops banked ids, unknown ids ignored, toggle-off
  keeps all, empty map no-op). Full typecheck/lint/test/build pass.

**Known Gaps:**
- None new. Reprint detection is a nudge, not tracked state (no record of which packet
  print preceded which import -- deliberate, no new stores).

**Files Modified:**
- web/lib/voters/{returnsStore,dashboard}.ts (+ test), web/app/dashboard/voters/actions.ts,
  web/components/dashboard/VotersExplorer.tsx, candidate/voter-file-plan.md

---

## 2026-07-11 -- v1.x -- GOTV war room: the final-stretch overview page

**Changes:**
- [added] `/dashboard/war-room` (staff dashboard, Field section, manageTeam gate) -- one
  read-only screen for the final stretch: countdowns to early voting (Jul 21) and the
  primary (Aug 4), a live snapshot of every field system linking to its page (ballot
  chase universe/banked/outstanding -- admin-only numbers; poll-shift fill rate with
  uncovered flagged; volunteers/captains; signs verified vs pending), the GOTV Timeline
  with done/current/upcoming markers, and the 4-3-2-1 contact schedule with the live row
  highlighted in the final four days.
- [added] `web/lib/gotv/warRoom.ts` (+ tests) -- pure countdown math; the timeline and
  contact-schedule content is VERBATIM from workflows/gotv-plan.md (this page adds only
  countdown status, never new advice). Sections degrade independently; aggregates only,
  no voter PII on the page.
- [updated] workflows/gotv-plan.md shipped pointer; sidebar gains "War room".

**Verifications Performed:**
- Unit: daysUntil (same-day/month-boundary/past), timeline window boundaries (4-days-out
  start, election day), activeContactRound (null outside the final 4 days; complete 4..0
  coverage). Dates cross-checked against candidate/poll-coverage-plan.md and the absentee
  guide. Full typecheck/lint/test/build pass.

**Known Gaps:**
- None new -- the page reads existing stores only; sections show honest empty states
  pre-ingest / pre-schedule.

**Files Modified:**
- web/lib/gotv/warRoom.ts (+ test), web/app/dashboard/war-room/page.tsx,
  web/components/dashboard/DashSidebar.tsx, workflows/gotv-plan.md

---

## 2026-07-11 -- v1.x -- Voter file Phase 5: canvass-ID write-back + ballot-chase board

**Changes:**
- [added] Canvass-ID write-back (the learning loop): the precinct drill-down records 1-5
  IDs from returned walk sheets (per-row selects saved in one batch). A saved ID replaces
  the party proxy -- canvass->S mapping defined once in `web/lib/voters/score.ts`
  (1->3, 2->2, 3->1, 4/5->0; identified "other" lean = do-not-chase) -- the segment
  recomputes, and the precinct's VOTERAGG re-aggregates with the exact ingest math
  (extracted to `web/lib/voters/aggregate.ts`, now shared by script and write-back).
- [added] Chase tiers (`web/lib/voters/chase.ts`, per tactics/ballot-chase-program.md):
  Tier 1 Chase Hard = MOBILIZE · 2 Chase Firm = BANK/T4 · 3 Chase Light = BANK/T5 ·
  4 Persuasion GOTV = PERSUADE; MONITOR/PROSPECT never chased. Rollups now carry
  per-tier universes (VOTERAGG.tiers).
- [added] Ballot-returns import + `/dashboard/voters/chase` (admin-only): paste the
  county's daily early-vote/absentee file (voter ids; conditional puts make cumulative
  re-imports idempotent -- never double-counted); returns resolve through a new
  voter-ID index the ingest writes (GetItem only, id-sharded); BALLOTAGG per-precinct
  counters feed the live Daily Chase Report (universe/banked/outstanding/% per tier,
  top-outstanding precincts, printable for the field huddle). Unmatched ids reported,
  never guessed.
- [updated] Ingest script now writes the ID index + tier counts (same commands);
  voter-file-plan Phase-5 note + status; ballot-chase-program shipped pointer;
  docs/VOTER-FILE.md re-ingest note. Sidebar gains "Ballot chase" (admin).

**Verifications Performed:**
- Unit: canvass->S table + a Strong-Grant-on-low-T voter landing in MOBILIZE/Tier 1;
  chase-tier matrix incl. never-chase cases; extracted aggregation reproduces the ingest
  math + tier cross-counts; Daily-Chase-Report math (summing, zero-division, pre-Phase-5
  rollups without tiers); returns-CSV mapper truth table. Refactored ingest script
  smoke-tested. Full typecheck/lint/test/build pass. SYNTHETIC fixtures only.

**Known Gaps:**
- The fitted support model stays deferred until canvass labels number in the thousands
  (restated in the plan -- no model-assisted claims before then). Rollups written by the
  pre-Phase-5 script lack tier counts until a re-ingest (called out on the chase board).

**Files Modified:**
- web/lib/voters/{aggregate,chase,canvassStore,returnsStore}.ts (+ tests),
  web/lib/voters/{score,store,storeTypes}.ts, web/lib/db.ts,
  web/scripts/ingest-voters.ts, web/app/dashboard/voters/{actions.ts,chase/page.tsx},
  web/components/dashboard/{VotersExplorer,ReturnsImport,DashSidebar}.tsx,
  candidate/voter-file-plan.md, tactics/ballot-chase-program.md, docs/VOTER-FILE.md

---

## 2026-07-11 -- v1.x -- Phase-4 gaps closed: Airtable turf sync + phone-append import

**Changes:**
- [added] `web/lib/voters/turfSync.ts` -- upserts cut walk turfs into the Airtable
  "Canvass Turf" table and the matched-phone count into "Contact Lists" (Volunteer
  Engagement base). SUMMARIES only -- turf name, doors/voters counts, captain, notes;
  voter names/addresses NEVER cross (RSMo 115.157 custody). Deterministic names make
  re-sync an update, not a duplicate; Walk Status/Priority/Area stay Airtable-curated
  after creation. Every write is fail-closed on the base's Front-End Access control
  table + the caller's viewVoterFile RBAC gate. "Sync counts to Airtable" button on the
  precinct drill-down reports created/updated/denied honestly.
- [added] Phone-append import (`web/lib/voters/phoneAppend.ts` pure mapper +
  `phoneStore.ts` VOTERPHONE partition + a paste-import card on /dashboard/voters):
  a purchased append CSV (phone + voter ID, or phone + name + ZIP5) feeds call
  lists/sheets immediately -- voter-ID rows match exactly and win; name+ZIP rows join
  the conservative matcher. MANUAL-DIAL ONLY: appended numbers never enter the SMS
  pipeline (TCPA; consent ledger stays the only texting gate).
- [updated] `candidate/voter-file-plan.md`: Phase-4 gap note replaced with the shipped
  sync; §6 gains a phone-append vendor brief (key by voter ID, match rate/wireless
  flags, contract use-limits; no vendors/prices named). The PURCHASE stays the
  campaign's decision -- the plumbing no longer blocks it.

**Verifications Performed:**
- Unit tests: turf-sync upsert logic against a mocked Airtable client (deterministic
  names, no-PII payload assertion, update never touches Walk Status, fail-closed
  governance reported honestly); append-CSV mapper truth table (aliases, ZIP+4
  truncation, skip reasons). Live Canvass Turf / Contact Lists schemas confirmed via
  Airtable MCP before coding. Full typecheck/lint/test/build pass.

**Known Gaps:**
- The phone-append vendor purchase itself (cost/contract) -- campaign decision; also
  event RSVPs stay out of phone matching (they carry no ZIP, and the conservative
  name+ZIP5 key is deliberate).

**Files Modified:**
- web/lib/voters/{turfSync,phoneAppend,phoneStore}.ts (+ tests), web/lib/db.ts,
  web/app/dashboard/voters/{actions.ts,page.tsx},
  web/components/dashboard/{VotersExplorer,PhoneAppendImport}.tsx,
  candidate/voter-file-plan.md

---

## 2026-07-11 -- v1.x -- Voter file Phase 4: walk packets, matched-phone call sheets, voter mail merge

**Changes:**
- [added] `web/lib/voters/walk.ts` -- pure walk-turf cutting: households (address+unit+zip),
  street-sorted walking order, ~40-60-door turfs (workflows/voter-targeting.md shift size),
  round-robin captain allocation. Defines the 1-5 canvass-ID scale ONCE (1 Strong Grant ...
  5 Strong other) so the printed key, CSV column, and Phase 5 write-back can't drift.
- [added] `web/lib/voters/phones.ts` -- conservative phone matching (full name + ZIP5,
  ambiguous keys dropped) against campaign records only (volunteers + donors who gave us
  their number). Matches fill the call CSV phone column and a printable MANUAL-DIAL call
  sheet; texting stays consent-ledger-gated, never voter-file-sourced (TCPA).
- [added] Print-only sheets on the voter drill-down (`VoterPacketSheets.tsx`): walk packets
  (one page-set per turf, canvass-ID + not-home columns, RSMo notice on every page) and the
  matched-phone call sheet. Internal ops docs -- no public disclaimer, per convention.
- [added] `tools/pdf-letterhead/voters_mailing.py` -- mail merge: a dashboard mail-list
  export becomes one letterhead PDF per segment (PERSUADE/MOBILIZE/BANK/PROSPECT; MONITOR
  skipped) with the verbatim "Paid for by Matt Grant for Congress." on every page.
- [updated] DonorRow now carries phone/zip (already stored by the WinRed webhook) for the
  matching path; voters page HowTo and `candidate/voter-file-plan.md` Phase-4 note.

**Verifications Performed:**
- Unit tests: household grouping/street sort, turf-size banding, doors-vs-voters counting,
  captain round-robin; phone match truth table (zip mismatch, missing phone, ambiguity,
  same-phone confirmation). Mail merge smoke-tested on a SYNTHETIC 5-row CSV -- 4 segment
  PDFs, MONITOR skipped, RSMo banner line handled, disclaimer verified on the rendered PDF.
  Election dates in the letters re-checked against candidate/absentee-voting-guide.md.

**Known Gaps:**
- Airtable Canvass Turf counts stay manual (no write path). Phone-append vendor remains an
  open user decision -- matching covers only people already in campaign records.

**Files Modified:**
- web/lib/voters/{walk,phones}.ts (+ tests), web/components/dashboard/VoterPacketSheets.tsx,
  web/components/dashboard/VotersExplorer.tsx, web/app/dashboard/voters/{page,actions}.tsx,
  web/lib/voters/dashboard.ts, web/lib/queries.ts, web/lib/table/configs.test.ts,
  tools/pdf-letterhead/voters_mailing.py, candidate/voter-file-plan.md

---

## 2026-07-11 -- v1.x -- Voter file Phase 3: real voter numbers on the map, Targets, and Signs

**Changes:**
- [added] `web/lib/voters/enrich.ts` -- pure enrichment of the VOTERAGG rollups: heuristic
  expected-primary voters per precinct (transparent recency weights over the T histogram,
  labeled heuristic per voter-file-plan.md §4), primary propensity 0..1, and PERSUADE/
  MOBILIZE/BANK universe counts; joined onto map/Targets precinct names via the ingest
  crosswalk (split precincts summed; unmatched labels reported, never dropped).
- [added] 3D map "Voter file" mode (`/dashboard/map`): shade = primary propensity, height
  = PERSUADE universe. The mode stays disabled until ingested aggregates actually join
  onto live precinct features -- no fake data pre-ingest.
- [added] Targets page Persuade + primary-propensity columns (screen + CSV export), joined
  server-side from the same rollups; footnote labels the heuristic and points to the plan.
- [added] Signs tool propensity autofill: a location's blank `propensity` fills from the
  voter file when its `precinct` column matches (normalized label); an explicitly typed
  value always wins. Pre-ingest the scorer's neutral default applies, as before.
- [updated] `candidate/voter-file-plan.md` §3 Phase-3 shipped note.

**Verifications Performed:**
- Unit tests: enrichment math (weights x T histogram), split-precinct summing, label
  lookup sums-before-ratio, autofill never overwrites an explicit value; map paint
  expressions for the new mode (color reads vPropensity, height scales persuade, legend
  declares the heuristic). Full typecheck/lint/test/build pass.

**Known Gaps:**
- All three surfaces light up only after the live ingest runs (user-side runbook in
  docs/VOTER-FILE.md); scores remain the §4 heuristic until Phase 5 canvass labels exist.

**Files Modified:**
- web/lib/voters/enrich.ts (+ test), web/app/api/geo/precincts/route.ts,
  web/lib/viz/precinctPaint.ts (+ test), web/components/MapExplorer.tsx,
  web/app/dashboard/targets/page.tsx, web/components/dashboard/TargetTable.tsx,
  web/app/dashboard/signs/page.tsx, web/components/dashboard/SignPlacementTool.tsx,
  candidate/voter-file-plan.md

---

## 2026-07-10 -- v1.x -- Voter file Phase 2: the /dashboard/voters command center

**Changes:**
- [added] `/dashboard/voters` behind a NEW admin-only `viewVoterFile` capability (rbac +
  ratchet test): RSMo 115.157 banner, district scoreboard + county mix from VOTERAGG
  rollups, sortable precinct table (voters / persuade / mobilize / bank), per-precinct
  drill-down (one bounded shard at a time -- never a district-wide scan) with segment/T/
  age-band/street filters, and walk / mail / call CSV exports stamped with the RSMo notice
  and guarded against spreadsheet formula injection. Call lists carry an EMPTY phone column
  by design (the file has no phones; SMS is never sourced from it).
- [updated] `candidate/voter-file-plan.md` §3 Phase-2 shipped note; sidebar gains "Voter
  database" (admin only).

**Verifications Performed:**
- 5 new dashboard-lib tests (rollups, combined filters, notice + per-channel headers,
  formula guard) + rbac ratchet updated; empty-state shows the exact ingest runbook.

**Known Gaps:**
- Page lights up only after the live ingest runs in the AWS environment (owner runbook).

**Files Modified:**
- web/lib/rbac.ts (+test), web/lib/voters/{store,storeTypes,dashboard}.ts (+test)
- web/app/dashboard/voters/*, web/components/dashboard/VotersExplorer.tsx, DashSidebar
- candidate/voter-file-plan.md

---

## 2026-07-10 -- v1.x -- Franklin County reconciliation (six-county MO-02)

**Changes:**
- [updated] the voter-file census (78,635 Franklin voters coded into 2025-map CD-2 -- the
  district's SECOND-LARGEST county) supersedes the earlier GIS-based exclusion; corrected
  everywhere the five-county district was asserted: `candidate/data-and-map-plan.md` (map
  table + rural-county list), `candidate/captain-field-plan.md` (captain zones need a
  Franklin extension), `candidate/sign-placement-plan.md`, `candidate/poll-coverage-plan.md`
  §3 (Franklin clerk added to early-vote coverage), `candidate/absentee-voting-guide.md`
  (county lists + a verified Franklin County Clerk contact block: 400 E Locust Rm 201,
  Union MO 63084, 636-583-6355, franklinmo.org).
- [updated] map/app: `web/lib/geoSources.ts` CENSUS_VTD gains Franklin (FIPS 29071) so the
  /api/geo/extra-counties boundary layer, the coverage-map county join, and the map search
  pick up Franklin automatically; `web/lib/countySources.ts` registry corrected + Franklin
  entry; `web/lib/countyTurnout.ts` (+ test) now expects five hand-fillable counties.

**Verifications Performed:**
- Franklin membership: the official voter file codes all 78,635 Franklin rows `25 CN 2`
  (full-file parse 2026-07-10, 0 failures). Franklin County Clerk contact verified
  2026-07-10 against franklinmo.org (clerk + absentee pages).

**Known Gaps:**
- Strategic-plan vote math and captain-zone assignments still assume the five-county
  weighting -- the Franklin extension of those plans is a strategy decision for the
  campaign manager, now unblocked by real numbers.

**Files Modified:**
- candidate/{data-and-map-plan,captain-field-plan,sign-placement-plan,poll-coverage-plan,absentee-voting-guide,voter-file-plan}.md
- web/lib/{geoSources,countySources,countyTurnout}.ts + countyTurnout.test.ts

---

## 2026-07-10 -- v1.x -- Voter file Phase 1: ingest engine + full-district census

**Changes:**
- [added] `web/lib/voters/{parse,score,crosswalk}.ts` (+ tests, synthetic fixtures only) --
  the pure voter engine: defensive 36-column row parser, the T 0-5 recency scorecard +
  labeled support proxy + targeting-matrix segments (BANK/MOBILIZE/PERSUADE/PROSPECT/
  MONITOR), and the precinct crosswalk (normalize + unambiguous matching, misses reported).
- [added] `web/scripts/ingest-voters.ts` (`npm run ingest:voters`) -- xlsx ingest CLI with
  --dry-run (report only, zero AWS needed) and live mode (sharded VOTER#county#precinct
  rows, VOTERAGG rollups, INGESTRUN manifest with file hashes).
- [updated] `candidate/voter-file-plan.md` §5 -- **the reconciliation is RESOLVED**: the
  full 577,366-row dry run (0 parse failures) shows six counties in 2025-map CD-2, with
  **Franklin County second-largest at 78,635 voters (13.6%)** -- the prior "Franklin is not
  in MO-02" description is contradicted by the official coding. Field-program docs
  (captain zones, sign turf, poll coverage, map layers) queued for a Franklin extension.

**Verifications Performed:**
- Full-file dry run: 577,366 voters (115,474 x4 + 115,470 -- matches inspection), 0
  unparseable, 178 precinct keys, 91.3% Active, party filled 11.7%, county census as
  tabled in the plan doc. Unit suite: 11 voter-lib tests green; tsc/lint clean.

**Known Gaps:**
- Live write requires AWS credentials (run in the deploy environment; command in the doc).
- Precinct-key granularity (178) vs map precincts -- crosswalk tuning lands in Phase 3.
- Franklin extension of field docs is queued, not yet applied.

**Files Modified:**
- web/lib/voters/* , web/scripts/ingest-voters.ts, web/package.json
- candidate/voter-file-plan.md

---

## 2026-07-10 -- v1.x -- Voter file Phase 0: custody, compliance, and the voter-engine plan

**Changes:**
- [added] `candidate/voter-file-plan.md` -- governing doc for the real MO-02 voter file
  (577,366 registered voters, 2025-map CD-2, inspected 2026-07-10): verified contents (one
  row per voter; birth YEAR only; party blank ~90%; Voter History = most recent election
  ONLY; NO phones or emails), S3 custody rules, RSMo 115.157 political-use-only
  restriction, the absolute TCPA line (SMS never from this file; matched/appended phones
  are call-lists only), sharded ingest architecture, honest scorecard (T 0-5 recency
  propensity + labeled support proxy + targeting-matrix segments), per-channel rules, and
  the open Franklin County district reconciliation.
- [removed] the five `docs/MO02_VotersList_Part*_of_5.xlsx` from the repo working tree
  (voter PII out of git; private S3 is canonical -- upload command in `docs/VOTER-FILE.md`;
  git-HISTORY purge is an open owner decision).
- [added] registered in SKILL.md, INDEX.md ("I need to contact voters"), commands
  (`/voterfile`).

**Verifications Performed:**
- File inspected via aggregate-only analysis (no PII printed): 577,366 rows across 5 parts
  (115,474 x4 + 115,470), 36 columns, no duplicate Voter IDs in a 50k sample, all sampled
  rows coded `25 CN 2`, counties incl. Franklin (~5-6% of sample).
- Repo confirmed PRIVATE before deciding custody steps.

**Known Gaps:**
- Franklin County reconciliation pending the Phase 1 per-county census.
- Full vote history (frequency-based propensity) needs a follow-up records request.
- Git-history purge and phone-append vendor are open owner decisions.

**Files Modified:**
- candidate/voter-file-plan.md
- docs/VOTER-FILE.md
- SKILL.md / INDEX.md / commands/commands.md

---

## 2026-07-10 -- v1.x -- Captains notified on shift self-signup/drop

**Changes:**
- [updated] supporter-hub shift self-signup now alerts the right person the moment a
  volunteer takes or drops a greeter shift: their team captain when they have one, else the
  campaign inbox (a dropped slot must never go unseen). Resolves the self-signup entry's
  Known Gap ("no notification to the captain"). Email includes the shift details and a
  shift-board link; drops are flagged for refilling.

**Verifications Performed:**
- Notifications are best-effort (never fail the claim/drop write) and reuse the existing
  staff-notify email path; no new channels or policy.

**Known Gaps:**
- Email only for now; a captain SMS ping could reuse the lifecycle-text path if wanted.

**Files Modified:**
- (web app only; no skill docs changed beyond this log)

---

## 2026-07-10 -- v1.x -- Seamless tier→WinRed clicks + tier-aware thank-you emails

**Changes:**
- [updated] `candidate/donor-value-ladder.md` §5 -- added the WinRed source-code map: every
  tier link now preselects its amount on WinRed (documented `?amount=` parameter) AND stamps
  a per-surface source code (web-ladder / web-impact / letter-supporter-levels /
  email-next-level) so WinRed reports show which button, letter, or email drove each gift.
- (companion web changes in the same PR: shared donateHref URL builder; the donation
  thank-you email now offers a one-click "give $Δ to reach [next level]" button with the
  exact difference preselected -- suppressed entirely at the $7,000 cycle max; the webhook
  captures WinRed's source code onto the contribution record when present)

**Verifications Performed:**
- WinRed `?amount=` preselection verified 2026-07-10 (WinRed Help Center, "Use URL
  Parameters"); the next-level ask is never shown to a maxed-out donor (unit-tested).

**Known Gaps:**
- WinRed webhook payload field name for the source code is normalized defensively
  (sc/source_code/utm_source aliases) -- confirm against a real webhook sample.

**Files Modified:**
- candidate/donor-value-ladder.md

---

## 2026-07-10 -- v1.x -- Supporter-levels donor letter (on-letterhead PDF)

**Changes:**
- [added] `tools/pdf-letterhead/donor_ladder_letter.py` -- a ready-to-send, on-letterhead
  one-pager outlining the supporter levels ($25→$7,000) for donor prospects: the tier table,
  the fine-print block (limits, designation, not-tax-deductible, best-efforts, prohibited
  sources), signature, and the Give Now QR band. Content mirrors
  `candidate/donor-value-ladder.md` and `web/lib/donorLadder.ts` -- edit together.
- [added] `brand_letter.py` gains a reusable on-brand `table` block (panel header, hairline
  rules) so any letter can carry structured content.
- [updated] `candidate/letters/print-tracker.csv` -- new Correspondence row (disclaimer +
  solicitation tax line required).

**Verifications Performed:**
- Letter copy restates only the value-ladder doc's verified facts (2026-07-10); the
  letterhead footer renders the paid-for-by disclaimer on every page; PDF built and reviewed.

**Known Gaps:**
- Recipient block is a placeholder -- personalize per send (or extend to a build_many mail
  merge like the community mailing).

**Files Modified:**
- tools/pdf-letterhead/donor_ladder_letter.py
- tools/pdf-letterhead/brand_letter.py
- candidate/letters/print-tracker.csv

---

## 2026-07-10 -- v1.x -- Donor value ladder (recognition tiers + FEC compliance)

**Changes:**
- [added] `candidate/donor-value-ladder.md` -- the $25→$7,000 donor recognition ladder
  (stickers → yard sign → tee → schwag kit + field briefing → reception with Matt → MO-02
  Founders Club → private roundtable at the $3,500/election max → $7,000 full-cycle level),
  with §3 FEC compliance gates: the full contribution counts against limits (premiums never
  netted), $7,000 requires general-election designation with the 60-day refund/redesignation
  rule, premiums are committee fundraising expenditures (campaign paraphernalia, not personal
  use), guaranteed-not-chance (no raffles under state gambling law), candidate access never
  tied to official action, prohibited-source/best-efforts/disclaimer rules unchanged; plus
  fulfillment ops (budget Items catalog, captain delivery, expenditure logging) and ready
  copy blocks.
- [added] registered in SKILL.md (candidate table), INDEX.md ("I need to raise money"), and
  commands/commands.md (`/donorladder`).
- (companion web change in the same PR: /donate page supporter-levels section + tier line in
  the donation thank-you email, driven by a shared `web/lib/donorLadder.ts`)

**Verifications Performed:**
- 2025-2026 limits verified 2026-07-10 against FEC.gov ($3,500/election; primary + general
  separate → $7,000 cycle), consistent with `federal/contribution-limits.md` (2026-07-03).
- Premium/personal-use framing verified against FEC.gov making-disbursements/personal-use
  guidance (campaign paraphernalia permissible; personal-use ban targets personal benefit).

**Known Gaps:**
- Event tiers name no dates/venues (committee schedules and announces); premium unit costs
  must be budgeted from the live Items catalog before the ladder is published.

**Files Modified:**
- candidate/donor-value-ladder.md
- SKILL.md
- INDEX.md
- commands/commands.md

---

## 2026-07-10 -- v1.x -- Volunteer self-signup for poll shifts (supporter hub)

**Changes:**
- [updated] `candidate/poll-coverage-plan.md` §4 shipped note -- signed-in volunteers can now
  take open greeter shifts (or drop ones they can't make) directly on the supporter hub;
  claims are self-scoped to the session identity, capacity-checked server-side, and land on
  the same field board and reminder pipeline captains already use.

**Verifications Performed:**
- Identity comes only from the authenticated session (the volunteer record key), never from
  form input; past shifts can't be joined or dropped; dropping clears the reminder claim so a
  replacement gets a fresh text.

**Known Gaps:**
- No notification to the captain on self-signup/drop yet -- the board reflects it immediately,
  but a captain watching only their phone won't know until they check.

**Files Modified:**
- candidate/poll-coverage-plan.md

---

## 2026-07-10 -- v1.x -- Captain shift reminders via their own text-alerts number

**Changes:**
- [fixed] shift-reminder recipient split: volunteer roster ids are `e:<email>` for email
  signups (never a raw email), so the previous "contains @" check misrouted email-keyed
  volunteers into the captain bucket and silently skipped them; the split now recognizes the
  roster's `e:`/`p:`/uuid id shapes (regression-tested with realistic ids).
- [updated] `candidate/poll-coverage-plan.md` §4 shipped note -- shift reminders now also
  reach captains, using the phone from each staffer's own "My text alerts" opt-in (the number
  already surfaced on the Team page's reachability column). Resolves the prior entry's Known
  Gap ("captains have no phone stored"). No new PII storage; consent, blocks, and quiet hours
  still enforced by the shared lifecycle-SMS helper.

**Verifications Performed:**
- No new SMS policy or storage introduced; captain numbers come only from the staffer's own
  self-service opt-in, never admin-entered.

**Known Gaps:**
- A captain who hasn't opted into text alerts is skipped (reported honestly in the send
  result) until they opt in under My notifications.

**Files Modified:**
- candidate/poll-coverage-plan.md

---

## 2026-07-10 -- v1.x -- Shift reminder texts (shift board → consent-gated SMS)

**Changes:**
- [updated] `candidate/poll-coverage-plan.md` §4 shipped note -- the shift board can now text
  each assigned greeter a per-day shift reminder through the campaign's existing lifecycle-SMS
  path: consent ledger + block list + 9am-8pm CT quiet hours all enforced by the shared helper,
  compliance suffix (paid-for + STOP) appended automatically, one message per person per day,
  deduped per shift+assignee so re-runs only reach newly added greeters.

**Verifications Performed:**
- No new SMS policy logic introduced -- the action delegates every gate to the existing
  `sendLifecycleText` helper; the reminder copy restates only the plan's verified §7 conduct
  rule (25-ft buffer) and adds no new legal claims.

**Known Gaps:**
- Captains (staff accounts) have no phone number stored anywhere in the app, so they are
  reported as skipped, not texted.

**Files Modified:**
- candidate/poll-coverage-plan.md

---

## 2026-07-10 -- v1.x -- Poll-coverage shift board shipped (dashboard tooling)

**Changes:**
- [updated] `candidate/poll-coverage-plan.md` §4 -- noted the shipped shift board at
  `/dashboard/coverage/shifts`: generates the site × day × window schedule, assigns greeters,
  computes the §8 fill metrics, and prints per-greeter shift packets with the §7 conduct rules
  plus an unfilled-shifts recruiting page.

**Verifications Performed:**
- Default window labels and key dates quote the plan's own §2/§4 (verified 2026-07-10); the
  printed compliance footer restates only §7's already-verified facts (RSMo 115.637 buffer)
  with the same re-verify caveat. No new statutes, dates, or hours introduced.

**Known Gaps:**
- Actual early-vote site hours remain a per-authority confirmation (the board's window labels
  are staff-editable text, not clock claims).

**Files Modified:**
- candidate/poll-coverage-plan.md

---

## 2026-07-10 -- v1.x -- Coverage page draws real region geometry

**Changes:**
- [updated] `candidate/data-and-map-plan.md` -- noted the shipped coverage-page map: Geo
  Hierarchy region names join to the existing boundary feeds (STL precincts by
  name/municipality, Jefferson precincts, rural VTDs, counties) and fill by coverage status
  (gap / covered / overlap).

**Verifications Performed:**
- No new data sources -- the map reuses the three already-wired geometry routes. St. Louis
  County is explicitly labeled "MO-02 portion" (no whole-county polygon exists in any wired
  feed); unmatched region names are listed, never guessed.

**Known Gaps:**
- Township-level region names have no matching property in any current feed and will list as
  unmatched until a boundary source is wired.

**Files Modified:**
- candidate/data-and-map-plan.md

---

## 2026-07-10 -- v1.x -- Doc sync: sign persistence + field-map features (post-merge pass)

**Changes:**
- [updated] `candidate/sign-placement-plan.md` §8.6 -- corrected the now-stale "nothing is
  uploaded" claim (scoring stays in-browser; rows upload only on "Save new locations") and
  replaced the re-edit-the-CSV verification instruction with the shipped inline workflow: saved
  placements persist durably, gates flip in the Saved-locations table (admin/captain via the
  `manageSigns` permission), and saved signs plot on the 3D field map (blue verified / amber
  pending). Scores/tiers are never stored -- always recomputed.
- [updated] `candidate/early-vote-site-verification-checklist.md` §4 -- the after-call workflow
  now uses the persistent Saved-locations table (paste the seed CSV once, save, flip gates per
  call) instead of re-editing and re-pasting the CSV; the §3 phone-call tracking table remains
  the call record.
- [updated] `candidate/data-and-map-plan.md` -- added a "map features shipped July 10, 2026"
  note (controls, search, column modes, Map↔Targets links, Signs layer) so the doc's picture of
  the live map stays accurate; data gaps unchanged.
- (companion app-copy fixes in the same PR: Signs page HowTo upload claim, map page HowTo gains
  the search + Signs-layer steps)

**Verifications Performed:**
- All statements describe features merged to main July 10, 2026 (PRs #330-#337); no new facts,
  law, or data introduced. Cross-links in the touched docs resolve.

**Known Gaps:**
- Rural-county turnout values and the live schools endpoint remain blocked on manual retrieval
  (documented with exact instructions in `candidate/data-and-map-plan.md`).

**Files Modified:**
- candidate/sign-placement-plan.md
- candidate/early-vote-site-verification-checklist.md
- candidate/data-and-map-plan.md
- references/update-log.md

---

## 2026-07-10 -- v1.x -- Early-vote seed CSV + verification checklist for the Signs tool

**Changes:**
- [added] `candidate/early-vote-sites-seed.csv` -- an 11-row seed for the Signs page's
  (`/dashboard/signs`) locations CSV: the 7 St. Louis County early-vote sites plus the 4 rural
  county Clerk offices (Jefferson, Washington, Crawford, Gasconade — each also their county's
  early-vote location), pulled from the already-verified list in `absentee-voting-guide.md`. No
  lat/lng or compliance flags are invented: coordinates are left blank pending geocoding, and
  `buffer_verified`/`property_permission` are `false` on every row until a human confirms.
- [added] `candidate/early-vote-site-verification-checklist.md` -- a call script (confirm active
  designation, hours, buffer/electioneering rules, permission, teardown deadline) plus a
  site-by-site tracking table with phone numbers, to clear the seed CSV's two hard gates before
  any sign deploys.
- [updated] `sign-placement-plan.md` §8.6 and §14 cross-link both new files.

**Verifications Performed:**
- All 11 addresses/phone numbers reused verbatim from `absentee-voting-guide.md` (verified
  July 10, 2026 against the county election-authority sites) — no new web research; no new facts
  invented.

**Known Gaps:**
- Exact lat/lng for all 11 sites remain unconfirmed (left blank by design).
- `buffer_verified`/`property_permission` for every row are `false` until a staffer completes the
  call script per site.

**Files Modified:**
- candidate/early-vote-sites-seed.csv
- candidate/early-vote-site-verification-checklist.md
- candidate/sign-placement-plan.md
- references/update-log.md

---

## 2026-07-10 -- v1.x -- Poll-coverage field plan (MO-02 Election-Day/early-vote staffing)

**Changes:**
- [added] `candidate/poll-coverage-plan.md` -- Election-Day & early-vote **field-coverage** plan: greeter coverage at designated early-vote sites and priority precinct polls, coverage prioritization (reusing the sign plan's site scoring), shift-staffing math, phased ops (foundations → assign/brief → early-vote coverage → Election Day → close-out), a mermaid flow, roles/metrics/risks, and a §7 compliance section. The companion to `sign-placement-plan.md` (where people go vs. where signs go); explicitly **defers ballot-integrity / credentialed poll-watching law** to `tactics/election-protection.md` rather than duplicate or invent it.
- [updated] audit fixes: §2 adds a scope note for the already-open excuse-based in-person window (≈Jun 23–Jul 20 — deliberately light-touch, with the rationale); §7 adds the verified early-vote buffer nuance (the statutory 25-ft rule is Election-Day-only; no statutory buffer exists during the absentee window per un-enacted HB 783 — site/authority rules govern, campaign voluntarily applies 25 ft) and an honesty note that Missouri watcher-credentialing specifics are NOT in this repo (arrange via county party committee + election authority).
- [updated] registered in SKILL.md (candidate reference table) and INDEX.md — poll-coverage listed under **"The election is coming"** (its real use-case cluster), sign plan cross-listed there too; `workflows/gotv-plan.md` "Polling Location Coverage" now points MO-02 users at the concrete plan.
- [added] slash commands `/signplan` and `/pollcoverage` (Print & Field Materials category) per the one-command-per-candidate-doc convention.

**Verifications Performed:**
- Reused already-verified facts: the 25-ft electioneering buffer (RSMo 115.637; HB 783's 100-ft proposal not enacted) from `library-print-and-produce-guide.md`; the operative 2025 MO-02 map (STL County portion + Jefferson/Washington/Crawford/Gasconade; excludes St. Charles/Franklin/Warren) from `data-and-map-plan.md`; the 2026 dates from `absentee-voting-guide.md`.
- All internal cross-links resolve; mermaid syntax checked (quoted labels).

**Known Gaps:**
- Site designations/hours, precinct rankings, and greeter/captain capacity are campaign-supplied placeholders; all staffing counts are illustrative.
- Poll-watcher/challenger credentialing is intentionally out of scope — must be arranged with the election authority (pointer only).

**Files Modified:**
- candidate/poll-coverage-plan.md
- SKILL.md
- INDEX.md
- references/update-log.md

---

## 2026-07-10 -- v1.x -- Sign placement master plan (MO-02 field ops)

**Changes:**
- [added] `candidate/sign-placement-plan.md` -- MO-02 yard/corridor/polling-place sign master plan for the Aug 4, 2026 primary: phased field ops (foundations → scoring → turf → early-vote deploy → Election Day → teardown), a per-type scoring/allocation model, CSV data schemas, and a full §9 compliance section. Finishes + hardens a campaign-supplied Draft v0.1 (completed the scoring model, added the missing compliance section; verified the 2026 dates and the district COMPOSITION — the final precinct-list confirmation remains an open §3 item that gates geocoding).
- [updated] registered in SKILL.md (candidate reference table) and INDEX.md ("print & produce" cluster)

**Verifications Performed:**
- 2026 MO primary dates (registration Jul 8; in-person no-excuse absentee Jul 21–Aug 3; mail-application received-by Jul 22; Election Day Aug 4, polls 6a–7p) reconciled with `candidate/absentee-voting-guide.md` and confirmed via a Missouri SOS / election-calendar web search on 2026-07-10.
- MO sign law reused from the already-verified `candidate/library-print-and-produce-guide.md` (verified 2026-06-18) and re-checked via web search 2026-07-10: 25-ft polling-place buffer (RSMo 115.637; HB 783's 100-ft proposal not enacted); right-of-way ban (RSMo 227.220 / MoDOT); resident political-sign protection (RSMo 442.404). Corrected the draft's erroneous "RSMo 67.317" (that statute governs FOR-SALE signs, not political).
- Operative 2025 MO-02 map composition (St. Louis County portion + Jefferson, Washington, Crawford, Gasconade; excludes St. Charles/Franklin/Warren) from `candidate/data-and-map-plan.md` and `candidate/captain-field-plan.md`.

**Known Gaps:**
- Final precinct list, early-vote/library site designations + hours, sign inventory (N), and volunteer/captain rosters are campaign-supplied — left as clearly-marked placeholders/open items.
- All scoring weights, factor ranges, and inventory splits are illustrative planning placeholders, not real data or predictions.
- Per-municipality sign ordinances (size/number/timing/removal deadlines) vary and must be confirmed per municipality before each deployment.

**Files Modified:**
- candidate/sign-placement-plan.md
- SKILL.md
- INDEX.md
- references/update-log.md

---

## 2026-07-10 -- v1.x -- Compliance freshness sweep (~4 weeks to the Aug 4 primary) + doc link fix

**Changes:**
- [updated] `candidate/absentee-voting-guide.md` -- the **July 8 voter-registration deadline has passed**; reframed the "confirm you're registered" step and the deadline table row so readers aren't told to hit a closed deadline (kept the live items: by-mail application by Jul 22, no-excuse in-person Jul 21-Aug 3, Election Day Aug 4). Re-stamped the verification block "Re-checked July 10, 2026."
- [updated] `states/missouri/contribution-limits.md` -- strengthened the staleness warning into an **UNDER RE-VERIFICATION** notice naming three contested items (the exact current CPI-adjusted per-person limit / uniformity across offices; corporate-union treatment after federal litigation; the CPI-adjustment interval stated as "biennial"), pointed to MEC + NCSL 2025-2026 + Ballotpedia to reconcile, and clarified this STATE-office file does **not** govern the federal MO-02 race (FEC-only, $3,500/election). Did **not** assert corrected numbers that couldn't be authoritatively confirmed (Amendment 2 limits are CPI-adjusted and in active litigation).
- [updated] `web/docs/social-go-live.md` -- fixed a broken relative link: `./google-youtube-setup.md` -> `../../docs/google-youtube-setup.md` (the file lives at top-level `docs/`).

**Verifications Performed:**
- FEC individual->candidate limit **$3,500 per election** (primary + general separate) confirmed current for 2025-2026 against the FEC published chart; `federal/contribution-limits.md` + `tools/donor-limit-checker.md` (stamped 2026-07-03) are accurate -> left unchanged.
- MO 2026 primary dates (registration Jul 8; mail-app Jul 22; in-person Jul 21-Aug 3; Election Day Aug 4) re-confirmed via SOS / news sources.
- MO state limits: web search (MEC, Ballotpedia, NCSL) showed the Amendment 2 base of $2,600 (Art. VIII §23.3(1)), CPI adjustment, and unconstitutional corporate/union provisions in flux -> flagged rather than rewritten (gov sites were not machine-fetchable; needs authoritative MEC confirmation).

**Known Gaps:**
- `states/missouri/contribution-limits.md` still shows the April-2026 figures in its body; they are now marked under-re-verification pending an authoritative MEC/NCSL check. A follow-up should reconcile the exact current numbers.

**Files Modified:**
- candidate/absentee-voting-guide.md
- states/missouri/contribution-limits.md
- web/docs/social-go-live.md
- references/update-log.md

---

## 2026-07-06 -- v1.x -- Campaign-defense artifacts (rapid response, deepfake, RACI/access, self-oppo, pre-publish)

**Changes:**
- [added] `workflows/rapid-response-sop.md` -- consolidated same-day rapid-response SOP: standing roles/on-call, a verify gate, a respond-vs-ignore triage matrix, draft/approve/publish, and a decision-log template (unifies pieces previously split across crisis-management, social-media-strategy, and press-release-templates)
- [added] `tactics/impersonation-deepfake-response.md` -- inbound defensive runbook for impersonation and doctored/AI-generated media: evidence capture, provenance verification, per-platform takedown, account-takeover recovery, and identity hardening
- [added] `tools/team-raci-access-matrix.md` -- one accountable owner per function (RACI) + a tool/account access matrix (CSV/JSON) + a same-day off-boarding revocation checklist and escalation path
- [added] `tools/self-oppo-tracker.md` -- schema for the candidate's own vulnerabilities (issue/source/likelihood/severity/pre-cleared response/owner) with a priority matrix and validation rules
- [added] `tools/pre-publish-checklist.md` -- single compliance gate before publishing: disclaimer + verbatim text, paid-vs-organic test, platform authorization, AI-disclosure, PII/donor data, coordination
- [updated] `tools/disclaimer-generator.md` -- added the required educational-disclaimer footer (was missing) and embedded the verbatim "Paid for by Matt Grant for Congress" as the worked example
- [added] 5 slash commands (`/rapidresponse`, `/deepfake`, `/accessmatrix`, `/selfoppo`, `/prepublish`) and a new "Crisis & Campaign Defense" command category
- [updated] registered all five in SKILL.md (workflow/tool/tactics tables), INDEX.md, and the tactics/workflows/tools READMEs

**Verifications Performed:**
- All relative markdown links in the new/edited files resolve to real paths
- Mermaid diagrams checked for valid syntax
- Faithful to CLAUDE.md facts (verbatim disclaimer, committee C00945394); all sample rows are labeled illustrative placeholders; no invented policy, vulnerabilities, or endorsements
- Guardrail check: all five are defensive/compliance only (ethics-and-guardrails Guardrail 6 permits rapid response; the campaign never impersonates or fabricates media)

**Known Gaps:**
- No web-dashboard surfaces for these artifacts yet (self-oppo page, access-matrix view) -- deferred follow-up
- Real names/accounts/vulnerabilities must be filled in by the campaign; placeholders only

**Files Modified:**
- workflows/rapid-response-sop.md
- tactics/impersonation-deepfake-response.md
- tools/team-raci-access-matrix.md
- tools/self-oppo-tracker.md
- tools/pre-publish-checklist.md
- tools/disclaimer-generator.md
- SKILL.md
- INDEX.md
- commands/commands.md
- tactics/README.md
- workflows/README.md
- tools/README.md
- references/update-log.md

---

## 2026-07-04 -- v1.x -- "What we missed" audit round 5 (deadline correctness, fail-closed suppression, edge IP, test gaps)

**Changes:**
- [updated] web/lib/ratelimit.ts -- resolved the round-4 `RATELIMIT_TRUSTED_PROXY_HOPS` open question. A live-edge measurement showed Amplify chains two CloudFront distributions, so the rightmost x-forwarded-for hop is a shared CloudFront IP (was over-bucketing real users), and `cloudfront-viewer-address` carries the true, edge-stamped client. `clientIp()` now prefers that header (IPv6-safe), with the XFF/hop-count path kept only as a non-CloudFront fallback -- no env tuning needed. Tests cover header preference, XFF-spoof immunity, IPv6.
- [updated] web/lib/subscribers.ts -- `isSuppressed()` failed **open**: a transient DynamoDB read error returned "not suppressed", so a globally unsubscribed/bounced/complained recipient could slip through the broadcast guard (CAN-SPAM risk). Now fails **closed** (treats a read error as suppressed); the sole caller (campaigns.ts send loop) counts it as suppressed and skips.
- [updated] federal/compliance-calendar.md -- surfaced the concrete FEC deadlines for the **Aug 4, 2026 MO-02 primary** (pre-primary report: close of books Jul 15, postmark-by Jul 20, received-by Jul 23; 48-hour-notice window Jul 15-Aug 4 for contributions >=$1,000; Q2 due Jul 15) in a dated callout + the July summary row, and caveated the stale 2025 general-election gantt as a generic template.
- [added] tests -- web/lib/sms/send.test.ts now pins the Twilio inbound-webhook signature wire format via independent recomputation (the consent auth gate had only a determinism test); web/lib/integrations/batchWrite.test.ts covers the UnprocessedItems retry/chunking/throw-loudly behavior that guards against silent write loss.

**Verifications Performed:**
- Aug-4-2026 primary confirmed via web search; FEC pre-primary/48-hour dates computed from 11 CFR 104.5 (fec.gov blocks automated fetch -- callout stamped for reconfirmation against the official Missouri notice).
- Edge topology confirmed with a temporary secret-gated diagnostic against the live Amplify deployment (chain: `<client>, <inner-CloudFront>`; `cloudfront-viewer-address` = the client); diagnostic removed after use.
- web/: `tsc --noEmit` clean, `eslint` clean on changed files, full vitest suite 1384 passed / 1 skipped.

**Known Gaps (report-only, no code change this round):**
- Amplify **build role** IAM likely scoped to `ssm:GetParameter` on `/matt-grant/*`, re-exposing the secrets moved to runtime -- scope to build-only params (infra/IAM, not in repo).
- `CLERK_SECRET_KEY` still written to `.env.production` at build (Clerk SDK reads `process.env`); confirm it doesn't reach the deployed bundle.
- amplify.yml `rm -rf .next/cache` vs caching `.next/cache` -> Next incremental cache never persists (build-cost only).
- Public AI routes (act/strategy, press/topics) have per-IP limits but no global token budget (cost-DoS; mitigated by Haiku + small max_tokens).
- Games leaderboard is replay-verified + ceiling-clamped but not bot-proof (client-chosen seed, no server nonce); cosmetic/PII-free.

**Files Modified:**
- web/lib/ratelimit.ts, web/lib/ratelimit.test.ts
- web/lib/subscribers.ts
- federal/compliance-calendar.md
- web/lib/sms/send.test.ts
- web/lib/integrations/batchWrite.test.ts
- references/update-log.md

---

## 2026-07-04 -- v1.x -- "What we missed" audit round 4 (rate-limit spoofing, unmetered routes, consistency)

**Changes:**
- [updated] web/lib/ratelimit.ts -- `clientIp()` read the **leftmost** x-forwarded-for hop, which is client-spoofable behind CloudFront/Amplify; an anonymous caller could rotate a fake IP per request and defeat every public rate limit at once (contact/join/events writes, SES/Airtable sends, paid Anthropic calls, print orders). Now counts from the right with a configurable trusted-proxy hop count (`RATELIMIT_TRUSTED_PROXY_HOPS`, default 1). **Verify the hop count against the live edge topology.**
- [updated] web/app/api/graphics/route.tsx, web/app/api/research/graphic/route.tsx, web/app/api/research/contrast-card/route.tsx -- added per-IP rate limits (60/min) to the three public satori/OG-image generators, which were unmetered and CPU/memory-heavy (compute/cost-DoS surface).
- [updated] web/components/dashboard/DonorTable.tsx -- the Total-column "over limit" badge still compared lifetime `totalCents` against the per-election cap (the round-3 fix corrected only the sibling filter chip); now uses `maxPerElectionCents`, so a compliant $3,500-primary + $3,500-general donor isn't falsely flagged.
- [updated] web/scripts/generate-social-graphics.mjs -- public share graphics printed `mattgrantforcongress.com`; canonical is `.org` (lib/site.ts). Fixed both footer lines.
- [updated] commands/commands.md -- `/position` was defined twice with different behaviors; renamed the press-release variant to `/positionpress`.
- [updated] infra/setup-aws.sh -- scheduled the `reconcile-roles` cron (Clerk role-drift safety net), which had a route but no EventBridge rule.
- [updated] web/app/(site)/issues/[slug]/page.tsx -- added an `aria-label` to the issue-detail `<video>` (was announced only as "video").
- [updated] tests -- rewrote lib/ratelimit.test.ts for the right-hop/configurable behavior.

**Verifications Performed:**
- web/: `tsc --noEmit` clean, `eslint` clean on changed files, `bash -n` on setup-aws.sh clean, full vitest suite 1377 passed / 1 skipped.
- Confirmed the assessment's **C2 scheduling gap is now resolved**: infra/setup-aws.sh wires EventBridge rules (with CRON_SECRET via a Connection) for email/social/sms drains, research ingest/news/bio, and district-insights; vercel.json is deleted.
- Skill-vs-app consistency verified: money.ts $3,500 constant, disclaimer wording, campaign facts (phone/email/address/FEC/WinRed), Aug-4-2026 date, and the four priorities all match canonical.

**Known Gaps (flagged, not fixed here):**
- **RATELIMIT_TRUSTED_PROXY_HOPS default (1) must be confirmed** against the live CloudFront/Amplify hop count — too low re-opens spoofing, too high buckets users together.
- **WCAG 1.2.2 video captions still missing** (issue-detail + /media players): only the `<track>` wiring and a `_TEMPLATE.en.vtt` exist; no production `.vtt` files, and axe CI cannot catch this. Authoring accurate captions requires the real video transcripts — human content task.
- `/api/act/strategy` calls the paid Anthropic API even for the public teaser (reflecting user `area`/`zip`/`issue` into the prompt); the now-effective rate limit is the only cost brake — consider gating the API to `depth:"full"`.
- No staleness alarm on last-drain/last-ingest timestamps; setup-aws.sh is not CI-invoked, so there's no automated proof it was applied in prod.
- The 11 orphaned candidate/*-plan.md files are intentional web build-plan docs, correctly not routed into SKILL.md.

**Files Modified:**
- web/lib/ratelimit.ts, web/lib/ratelimit.test.ts
- web/app/api/graphics/route.tsx, web/app/api/research/graphic/route.tsx, web/app/api/research/contrast-card/route.tsx
- web/components/dashboard/DonorTable.tsx
- web/scripts/generate-social-graphics.mjs
- web/app/(site)/issues/[slug]/page.tsx
- infra/setup-aws.sh
- commands/commands.md
- references/update-log.md

---

## 2026-07-04 -- v1.x -- "What we missed" audit round 3 (accuracy, structure, donation idempotency)

**Changes:**
- [updated] federal/contribution-limits.md -- corrected the excessive-contribution cure window from **30 days** to **60 days** (11 CFR 110.1) in both the enumerated-options intro and the enforcement sentence. The 30-day figure is the *prohibited-source* rule (correctly stated in prohibited-contributions.md) and had been conflated here; it also contradicted tools/donor-limit-checker.md and tools/contribution-tracker.md, which already say 60 days.
- [updated] CLAUDE.md, SKILL.md -- corrected the false "other states have overview files only" claim (all 11 covered states carry the full 5-file set) and added a routing note so the skill loads each non-Missouri state's contribution-limits / disclosure-requirements / ballot-access / local-rules files, not just overview.md (previously 40 complete state files were undiscoverable).
- [updated] INDEX.md, commands/README.md -- removed two dangling links to a nonexistent repo-root `commands.md` (the real file is commands/commands.md, correctly linked alongside).
- [updated] tools/contribution-tracker.md, tools/expenditure-tracker.md -- added the required educational disclaimer footer (both carry compliance content and were missing it).
- [updated] candidate/letters/senate-targets.csv -- corrected party labels for Sen. Patty Lewis (Dist. 7) and Sen. Maggie Nurrenbern (Dist. 17) from R to D (verified against the Missouri Senate roster / Ballotpedia); a committee-majority assumption had bled into the party field.
- [updated] web/lib/donors.ts -- made contribution recording atomically idempotent: the append is now guarded by a per-externalId `seenIds` set + ConditionExpression (was a non-atomic read-then-write that could double-count FEC-reportable totals under concurrent WinRed webhook retries), and gifts with no email now key on the externalId so retries collapse onto one row instead of creating a random-keyed row per delivery.
- [updated] web/lib/queries.ts, web/lib/table/donors-config.ts -- the "Over per-election limit" donor facet now compares the max net total in any single election against the $3,500 per-election cap (was comparing the lifetime total across all elections, which would false-flag a compliant $3,500-primary + $3,500-general donor once general-election gifts are recorded).
- [updated] web/lib/donors.test.ts, web/lib/table/configs.test.ts -- rewrote/extended tests to cover the atomic idempotency (condition-failure no-op) and the election-aware limit facet.

**Verifications Performed:**
- Party labels verified 2026-07-04 via web search against senate.mo.gov and Ballotpedia (both Lewis and Nurrenbern are Democrats).
- 60-day excessive-contribution cure window cross-checked against the repo's own tools files and 11 CFR 110.1.
- web/: `tsc --noEmit` clean, `next lint` clean on changed files, full vitest suite 1376 passed / 1 skipped.
- Confirmed no remaining stale federal figures and no dangling root-`commands.md` references after the fix.

**Known Gaps:**
- Infra items from the 2026-06-19 assessment (Amplify EventBridge cron for email-drain/research-ingest, domain cutover, secret-baking, DynamoDB PITR) are human/IaC-owned and out of scope for this code round.
- `seenIds` grows one entry per distinct donation per donor row; unbounded over many years but negligible at campaign scale.

**Files Modified:**
- federal/contribution-limits.md
- CLAUDE.md, SKILL.md, INDEX.md, commands/README.md
- tools/contribution-tracker.md, tools/expenditure-tracker.md
- candidate/letters/senate-targets.csv
- web/lib/donors.ts, web/lib/queries.ts, web/lib/table/donors-config.ts
- web/lib/donors.test.ts, web/lib/table/configs.test.ts
- references/update-log.md

---

## 2026-07-03 -- v1.x -- Federal contribution-limit reconciliation (2025-2026 cycle)

**Changes:**
- [updated] federal/contribution-limits.md -- reconciled the indexed individual / non-multicandidate-PAC → candidate limit to **$3,500/election** (was $3,300), primary+general to **$7,000** (was $6,600), and individual / non-multicandidate-PAC → national party to **$44,300/yr** (was $41,300); the non-multicandidate-PAC → candidate cell (previously $2,900) is reconciled to the indexed $3,500. Verification date stamped in the staleness banner and the JFC/family-member examples updated.
- [updated] tools/donor-limit-checker.md -- the operational go/no-go tool: decision-tree limit, Step 3/Step 4 figures, the federal limits table, and the worked sample outputs all moved $3,300 → $3,500 (and $6,600 → $7,000); non-multicandidate-PAC per-election corrected $2,900 → $3,500.
- [updated] tools/contribution-tracker.md -- sample aggregate-tracking rows updated to the $3,500 cap.
- [updated] federal/fec-overview.md -- non-multicandidate PAC comparison corrected to $3,500/election.
- [updated] states/{missouri,texas,florida,ohio,illinois,pennsylvania,michigan,arizona,new-york,georgia,california}/overview.md -- the federal-comparison rows citing $3,300 updated to $3,500 (2025-2026); stale "(2023-24)" labels refreshed to "(2025-26)".

**Verifications Performed:**
- 2025-2026 FEC limits re-verified 2026-07-03: individual / non-multicandidate-PAC → candidate = **$3,500/election** (matches web/lib/money.ts, verified against fec.gov 2026-06-18); individual → national party = **$44,300/yr**. Cross-checked against fec.gov via web search.
- Closes the known gap where the reference files still carried the 2023-2024 ($3,300 / $41,300) figures.

**Known Gaps:**
- Only the indexed figures re-verified this cycle were changed; other indexed rows (coordinated party expenditure limits, PAC→party) still carry a "verify at fec.gov" caveat.
- Illustrative straw-donor example amounts in federal/prohibited-contributions.md intentionally left as-is (they are arbitrary example figures, not stated current limits).

**Files Modified:**
- federal/contribution-limits.md
- tools/donor-limit-checker.md
- tools/contribution-tracker.md
- federal/fec-overview.md
- states/missouri/overview.md, states/texas/overview.md, states/florida/overview.md, states/ohio/overview.md, states/illinois/overview.md, states/pennsylvania/overview.md, states/michigan/overview.md, states/arizona/overview.md, states/new-york/overview.md, states/georgia/overview.md, states/california/overview.md
- references/update-log.md

---

## 2026-06-29 -- v1.x -- SMS / Text Messaging Compliance & Templates

**Changes:**
- [added] messaging/sms-texting.md -- complete SMS program guide: toll-free verification submission content, opt-in/consent language, compliant message templates (fundraising, GOTV, event, volunteer) with FEC disclaimer + STOP, TCPA + FEC compliance checklist, website opt-in form copy, keyword auto-responder (double opt-in) sequence, inbound reply handling, cadence/opt-out-rate guardrails, peer-to-peer texting scripts, and FEC cost-tracking guidance
- [updated] SKILL.md -- new row in the messaging reference table
- [updated] INDEX.md -- added to the "I need to contact voters" use case
- [updated] messaging/README.md -- file-list bullet
- [updated] commands/commands.md -- routed `/textscript` and `/eventinvite` (text version) to messaging/sms-texting.md
- [updated] tools/disclaimer-generator.md -- cross-reference from the SMS/MMS section to the new file
- [updated] messaging/email-fundraising.md, messaging/digital-footprint-strategy.md -- "Related" cross-reference to the new file

**Verifications Performed:**
- FEC SMS disclaimer treatment confirmed against tools/disclaimer-generator.md (52 USC 30120 / 11 CFR 110.11); used the verbatim committee disclaimer "Paid for by Matt Grant for Congress."
- All campaign facts (FEC C00945394, MO-02, primary Aug 4 2026, toll-free +1 844-314-7912, contact info, WinRed donate link) sourced only from documented facts in CLAUDE.md
- Cross-references resolve in both directions (sms-texting <-> disclaimer-generator, email-fundraising, digital-footprint-strategy, expenditure-tracker/expenditure-tracking)
- Mermaid diagram syntax validated (3 flowcharts, all valid)

**Known Gaps:**
- TCPA quiet-hours (8am-9pm local) and opt-out-rate thresholds are general best-practice guidance, not carrier-published limits -- flagged in-file to confirm current carrier policy with Twilio and consent approach with counsel
- List segmentation (Section 11) and per-send metrics (Section 12) since added
- MMS/media-specific guidance and a glossary term deferred as optional
- Toll-free number was In Review at time of writing; templates not yet live-tested

**Files Modified:**
- messaging/sms-texting.md
- SKILL.md
- INDEX.md
- messaging/README.md
- commands/commands.md
- tools/disclaimer-generator.md
- messaging/email-fundraising.md
- messaging/digital-footprint-strategy.md
- references/update-log.md

---

## 2026-06-24 -- v1.x -- Captain Onboarding & Training Guide

**Changes:**
- [added] workflows/captain-onboarding-training.md -- the captain's operating manual: development lifecycle, what a captain owns, onboarding (first-week checklist + orientation agenda + phase-mapped timeline), running a shift (adapted from volunteer-management), the weekly captain cadence (turns "review weekly" into a real agenda), archetype-aware coaching (one focus + one guardrail per archetype, linked to source), captain talking points tied to the four priorities, self-coaching tools, compliance, key principles
- [updated] SKILL.md -- new row in the Workflow reference table
- [updated] INDEX.md -- added to the "I need to build a volunteer leadership team" use case
- [updated] workflows/README.md -- file-list bullet
- [updated] commands/commands.md -- added `/captainonboarding`
- [updated] references/glossary.md -- added "Captain Onboarding"

**Verifications Performed:**
- Cross-references resolve (captain-onboarding-training ↔ captain-archetypes development needs, team-pairing weekly review + ladder + compliance, volunteer-management shift/training, captain-roster health rules, candidate/strategic-plan phases + pillars, candidate/platform four priorities, artifacts/campaign-documents + messaging for voter-facing scripts)
- Adapts rather than duplicates volunteer-management shift/training; summarizes-and-links archetype development needs rather than restating them
- Talking points stay within documented priorities + family-court message; no invented policy, statutes, endorsements, or poll numbers; no PII fields
- Mermaid diagram validated

**Known Gaps:**
- Coaching is a framework; effective use depends on the specific captain's background and learning style
- Timeline is phase-mapped (not fixed dates) and any team counts are illustrative

**Files Modified:**
- workflows/captain-onboarding-training.md
- SKILL.md
- INDEX.md
- workflows/README.md
- commands/commands.md
- references/glossary.md
- references/update-log.md

---

## 2026-06-24 -- v1.x -- Captain Roster Schema + MO-02 Field Plan + Artifact Spec

**Changes:**
- [added] tools/captain-roster.md -- CSV/JSON data schema for the field-leadership roster (captains, archetypes, roles, co-captains, volunteers, supporter-pipeline targets); the storable form of the team-pairing worksheet. Closes the "no tools schema" gap noted in the prior entry. Mirrors contribution-tracker.md.
- [added] candidate/captain-field-plan.md -- applies the captain framework to Matt Grant's real MO-02 field program (5-county 2025 map, Aug 4 2026 primary, family-court signature cause, 5 messaging pillars, GOTV timeline). Every quantitative figure is a labeled illustrative placeholder per strategic-plan.md.
- [updated] artifacts/campaign-documents.md -- new "Field Leadership Roster (Captain Pairing)" entry under Strategy Documents (the `/captainmatch` output spec)
- [updated] commands/commands.md -- added `/captainroster` (→ tools/captain-roster.md)
- [updated] SKILL.md -- new rows in the Tool and Candidate-files reference tables
- [updated] INDEX.md -- added the roster and field plan to the "volunteer leadership team" use case
- [updated] tools/README.md -- file-list bullet for captain-roster.md
- [updated] references/glossary.md -- added "Donor Ambassador" and "Regional Coordinator"

**Verifications Performed:**
- Confirmed cross-references resolve (captain-roster ↔ team-pairing, captain-archetypes, donation-intake, donor-limit-checker, ethics-and-guardrails; captain-field-plan ↔ strategic-plan, data-and-map-plan, gotv-plan, ballot-chase-program)
- Roster schema enums (archetypes, roles) and worksheet columns match the merged captain files exactly; pipeline rungs match team-pairing Part C
- MO-02 field plan uses only documented facts (district map, date, priorities, pillars); all counts/names are labeled illustrative placeholders; no invented policy, endorsements, or poll numbers; no SSN/bank/PII fields

**Known Gaps:**
- Captain assignments in the roster and field plan are illustrative; replace with the campaign's real recruitment before deployment
- Rural-county (Washington/Crawford/Gasconade) precinct-level turnout is not available from live feeds (see data-and-map-plan.md)

**Files Modified:**
- tools/captain-roster.md
- candidate/captain-field-plan.md
- artifacts/campaign-documents.md
- commands/commands.md
- SKILL.md
- INDEX.md
- tools/README.md
- references/glossary.md
- references/update-log.md

---

## 2026-06-24 -- v1.x -- Team Captain Archetypes + Pairing Workflow

**Changes:**
- [added] tactics/captain-archetypes.md -- six team-captain leader types (Organizer, Connector, Workhorse, Mentor, Closer, Strategist) with strengths/weaknesses/best-fit roles, plus a seven-role captain table; mirrors the voter-personas framework
- [added] workflows/team-pairing.md -- three-part pairing workflow (archetype→role, captain→volunteers + complementary co-captain, volunteer→supporter/sponsor/donor ladder) with matrices, a roster worksheet, and a compliance/ethics disclaimer
- [updated] SKILL.md -- new rows in the Tactics and Workflow reference tables
- [updated] INDEX.md -- new "I need to build a volunteer leadership team" use-case section
- [updated] tactics/README.md, workflows/README.md -- file-list bullets for the two new files
- [updated] commands/commands.md -- added `/captaintypes` and `/captainmatch`
- [updated] references/glossary.md -- added "Captain Archetype" and "Team Captain"

**Verifications Performed:**
- Confirmed all internal cross-references resolve to real files (captain-archetypes ↔ team-pairing ↔ volunteer-management, fundraising-plan, surrogate-program, donor-limit-checker, donation-intake, ethics-and-guardrails)
- Reused existing frameworks (voter-personas layout, surrogate deployment matrix, fundraising Ask Ladder + cultivation) rather than introducing new structure
- Content is nonpartisan/general toolkit guidance; no invented statutes, contribution limits, policy positions, or endorsements

**Known Gaps:**
- Captain archetypes are an organizing heuristic, not a validated typology; coach to the real people on the team
- No `tools/` data schema for the pairing roster yet (worksheet is described inline in team-pairing.md)

**Files Modified:**
- tactics/captain-archetypes.md
- workflows/team-pairing.md
- SKILL.md
- INDEX.md
- tactics/README.md
- workflows/README.md
- commands/commands.md
- references/glossary.md
- references/update-log.md

---

## 2026-06-24 -- Absentee: printable request form + library printing

**Changes:**
- [added] web/public/absentee-ballot-request-form.pdf -- the official Missouri Secretary of State "Request for Missouri Absentee Ballot" form (SOS-issued, modified 2026-04-10), served at `/absentee-ballot-request-form.pdf`
- [updated] web/app/(site)/vote/absentee/page.tsx -- new "Prefer paper? Print the request form" section: download button for the PDF plus 4-step St. Louis County Library mobile-printing instructions (mobileprint.slcl.org/myprintcenter) for voters who can't complete the application online
- [updated] candidate/absentee-voting-guide.md -- mirrors the same printable-form link and library-printing steps

**Verifications Performed:**
- Confirmed the uploaded PDF is the SOS "Request for Missouri Absentee Ballot" form via embedded metadata (Company: "Missouri Secretary of State Office"; Title: "Request for Missouri Absentee Ballot")
- Web typecheck (`tsc --noEmit`) and `next lint` pass clean for the absentee page; PDF placed in `web/public/` (served at the site root by Next)

**Known Gaps:**
- Library mobile-printing flow and the $5/month free-printing allowance are described per the existing candidate/library-print-and-produce-guide.md; confirm current library pricing/flow before heavy promotion
- The mailed paper form must still meet the same 5 p.m. July 22 receipt deadline and notary rules as the online application

**Files Modified:**
- web/public/absentee-ballot-request-form.pdf
- web/app/(site)/vote/absentee/page.tsx
- candidate/absentee-voting-guide.md
- references/update-log.md

---

## 2026-06-24 -- Absentee & Early Voting Guide

**Changes:**
- [added] candidate/absentee-voting-guide.md -- supporter/voter guide to voting early or absentee in MO-02 for the Aug 4, 2026 primary: the three voting options (no-excuse early in person, absentee by mail, absentee in person), the dates table, the six excuse reasons, the notary rule (#1/#3/#4 require notarization; #2/#6 exempt), the online application walkthrough, photo-ID list, and the St. Louis County / St. Charles County election authorities; carries staleness + educational disclaimers and a Mermaid decision flow
- [added] web/app/(site)/vote/absentee/page.tsx -- new `/vote/absentee` page on the campaign site rendering the same guide content (dates table, three options, qualification reasons, application arc, photo ID, county authorities), with prominent outbound links to the official Missouri SOS voting-rules page and the county authorities
- [updated] web/app/(site)/vote/page.tsx -- step 3 "Vote early or absentee" CTA now points to the internal `/vote/absentee` page (was the external SOS go-vote page); added a secondary "Official Missouri voting rules" link to the prior SOS go-vote page so the voting-rules page it replaced stays reachable
- [updated] SKILL.md -- candidate-files load-when row for the absentee voting guide
- [updated] INDEX.md -- "I need to contact voters" section entry
- [updated] commands/commands.md -- `/voteabsentee` command in GOTV & Events

**Verifications Performed:**
- Dates/deadlines verified June 24, 2026 against the Missouri SOS and the St. Louis County / St. Charles County election authorities: register July 8; excuse-based absentee opens ~June 23; by-mail application received by 5 p.m. July 22; no-excuse early in-person voting July 21–Aug 3; voted ballot received by 7 p.m. Aug 4 — all confirmed
- Notary rules corrected: incarceration (#5) is notary-exempt (was omitted) alongside illness/disability (#2) and Safe at Home (#6), plus permanently disabled and covered military/overseas voters; reasons #1/#3/#4 generally require notarization, with a caveat added to confirm with the county authority (county sources vary on #1/#4). Applied to both the markdown guide and the `/vote/absentee` page
- Web typecheck (`tsc --noEmit`) and `next lint` pass clean for both vote pages; both routes render HTTP 200 on a local dev server
- Internal cross-references (SKILL.md, INDEX.md, commands.md) confirmed to point to the new file path

**Known Gaps:**
- Early-voting site lists and county hours are samples — the guide and page both direct voters to stlouiscountymovotes.gov / sccmo.org to confirm
- Skill markdown (candidate/absentee-voting-guide.md) is not a served web route; the served voter-facing version is the `/vote/absentee` page
- The campaign FEC disclaimer line in the markdown guide is a placeholder pending committee/treasurer confirmation

**Files Modified:**
- candidate/absentee-voting-guide.md
- web/app/(site)/vote/absentee/page.tsx
- web/app/(site)/vote/page.tsx
- SKILL.md
- INDEX.md
- commands/commands.md
- references/update-log.md

---

## 2026-06-24 -- Print Production Tracker

**Changes:**
- [added] candidate/letters/print-tracker.csv -- letter-sized (8.5 x 11) print queue; adds a `template` column tying each of the 26 printable items to the repo template that produces it, plus 6 rows for the recently-built mailings (legislator, community Faith/Business/Education/Civic, Local & Civic, tier-1 cover letters, family-court letter, CHILD Protection Act brief enclosure)
- [added] tools/print-tracker.md -- skill page: CSV schema + field definitions, the master template map (item -> template, by category), compliance notes (disclaimer / solicitation tax line / internal-only), and best practices
- [added] web/app/dashboard/print/page.tsx + web/scripts/generate-print-tracker.mjs + web/lib/printTracker.json -- staff dashboard view of the same CSV (data-as-code manifest, mirroring the print-renditions pattern); `/dashboard/print` nav entry in DashSidebar (Comms group)
- [updated] SKILL.md -- Tool reference files row for tools/print-tracker.md
- [updated] INDEX.md -- "I want to print & produce materials" section entry
- [updated] commands/commands.md -- `/printtracker` command in Print & Field Materials
- [updated] web/package.json -- `print-tracker` script

**Verifications Performed:**
- Every `template` path in the CSV/skill page confirmed to resolve to a real committed file (git ls-files)
- Disclaimer flag basis: 52 USC 30120 / 11 CFR 110.11 (public political communications); solicitation tax line basis cross-referenced to federal/disclosure-requirements.md; exact statutory text not paraphrased
- Web generator output (lib/printTracker.json) regenerated from the CSV; one entry per row

**Known Gaps:**
- Production fields (quantity, vendor, unit_cost, order_by_date, in_hand_date) are blank until the campaign queues each piece
- Web "template" cells show the repo path as reference text — skill markdown is not a served web route

**Files Modified:**
- candidate/letters/print-tracker.csv
- tools/print-tracker.md
- SKILL.md
- INDEX.md
- commands/commands.md
- references/update-log.md
- web/app/dashboard/print/page.tsx
- web/scripts/generate-print-tracker.mjs
- web/lib/printTracker.json
- web/components/dashboard/DashSidebar.tsx
- web/package.json

---

## 2026-06-18 -- Library Print & Produce Guide

**Changes:**
- [added] candidate/library-print-and-produce-guide.md -- supporter guide to print campaign materials and make signs/banners/swag/video at the St. Louis County Library, plus a "use them responsibly" section with Missouri sign & electioneering rules and a tear-off checklist
- [updated] INDEX.md -- new "I want to print & produce materials" use-case section (library guide + Walgreens plan + disclaimer generator)
- [updated] SKILL.md -- candidate-files load-when row for the library guide

**Verifications Performed:**
- Missouri polling-place electioneering buffer = **25 feet** from the nearest outer door on election day (RSMo 115.637); 2023 HB 783 proposal to widen to 100 ft was NOT enacted
- Campaign signs prohibited on state right-of-way (RSMo 227.220 / MoDOT policy); removed signs held 30 days at the local MoDOT facility (1-888-ASK-MoDOT)
- Sources: revisor.mo.gov RSMo 115.637, 227.220, 442.404; MoDOT "Know Where They Go" (modot.org/node/11753)

**Known Gaps:**
- Local municipal sign ordinances vary and are not enumerated — guide directs users to confirm with their city
- Library equipment availability is branch-specific; only the Clark Family Branch is confirmed to hold the full creative lab

**Files Modified:**
- candidate/library-print-and-produce-guide.md
- INDEX.md
- SKILL.md
- references/update-log.md

---

## 2026-04-03 -- v1.0 -- Initial Release

**Changes:**
- [added] campaign-lifecycle.md -- 7-phase campaign lifecycle reference
- [added] roles.md -- 5 campaign roles with responsibilities and compliance duties
- [added] glossary.md -- 65+ campaign term definitions
- [added] ethics-and-guardrails.md -- 9 guardrails with edge cases and decline guidance
- [added] agency-directory.md -- Election agencies for 50 states + DC + FEC
- [added] update-log.md -- This file

**Verifications Performed:**
- FEC contribution limit structure confirmed (specific dollar amounts require annual verification)
- Federal filing requirements cross-referenced with FEC.gov guidance
- State agency names verified against known secretaries of state offices
- Campaign finance terminology aligned with FEC glossary definitions

**Known Gaps:**
- 39 states need detailed coverage beyond agency contact info (filing requirements, contribution limits, ballot access specifics, reporting calendars)
- Local election rules (county, municipal, school board) are sparse across all jurisdictions
- Contribution limits for all levels need annual verification; federal limits adjust on odd-year cycles
- State-specific ballot access requirements (petition signatures, fees, deadlines) not yet cataloged
- Judicial election rules not covered (vary significantly and have distinct ethics rules)
- Recall election procedures not covered
- Ballot initiative/referendum procedures not covered
- Territory elections (Puerto Rico, Guam, USVI, American Samoa, CNMI) not covered
- Campaign finance software and vendor recommendations intentionally omitted (changes rapidly, potential conflicts)

---

## Maintenance Schedule

| Task | Frequency | Next Due |
|------|-----------|----------|
| Verify federal contribution limits | Annually (odd years) | 2027-01-15 |
| Check state agency websites and phone numbers | Annually | 2027-04-03 |
| Review glossary for new/changed terms | Semi-annually | 2026-10-03 |
| Update guardrails for new legal developments | As needed | Ongoing |
| Add detailed state coverage (target: 5 states/quarter) | Quarterly | 2026-07-03 |
| Review for accuracy after major court decisions | As needed | Ongoing |

---

## Versioning Convention

- **Major version (X.0):** Structural changes, new reference files, significant policy changes
- **Minor version (X.Y):** Content additions, corrections, expanded state coverage
- **Entries are prepended** so the most recent update appears first after the template
