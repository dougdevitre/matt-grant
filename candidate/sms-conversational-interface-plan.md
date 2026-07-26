# SMS Conversational Interface Plan — Geo-Aware Early-Vote Agent (County / ZIP / School District)

This plan upgrades the campaign's SMS program from one-way keyword replies to a geo-aware conversational interface on the toll-free number **+1 844-314-7912**, so a supporter who texts us gets early-vote guidance specific to their county, ZIP code, and (later) school district — and so broadcasts can be targeted by those same dimensions without ever touching the voter-file TCPA wall. It is grounded in an audit of the shipped SMS stack (`web/lib/sms/*`, `web/app/api/webhooks/twilio/`), the voter data engine (`web/lib/voters/*`, `web/lib/reports/smsTargeting.ts`), and the governing docs (`candidate/sms-targeting-plan.md`, `candidate/twilio-fund-plan.md`, `candidate/voter-file-plan.md`, `candidate/absentee-voting-guide.md`, `messaging/sms-texting.md`). It also covers the immediate deliverable: the early-vote announcement broadcast for the July 21 – August 3 no-excuse window.

> **Date check (verified via web search July 20, 2026).** No-excuse in-person absentee ("early") voting for the Aug 4, 2026 primary begins **Tuesday, July 21** — *tomorrow*, not today — and runs through **5:00 p.m. Monday, Aug 3**. The **by-mail ballot application must be RECEIVED by 5:00 p.m. Wednesday, July 22**. These match `candidate/absentee-voting-guide.md` (last re-checked 2026-07-10). So today's message is a "starts tomorrow + mail deadline Wednesday" alert — which is the stronger send anyway — followed by an "early voting is OPEN" message tomorrow morning. Confirm exact hours with each county election authority before sending site-specific details.

---

## 1. Where Things Stand Today (Audit Summary)

| Area | Shipped | Gap |
|---|---|---|
| **Broadcasts** | Composer at `/dashboard/sms` → `createSmsCampaign` → cron drain (`web/lib/sms/campaigns.ts`), quiet hours 9am–8pm CT, auto compliance suffix, RBAC (admin full list / captain own team) | No geographic targeting of any kind |
| **Conversational surface** | Keyword router in `web/app/api/webhooks/twilio/route.ts`: STOP/START/HELP, opt-in keyword MATT, CTAs DONATE / VOLUNTEER / EVENTS / VOTE (`web/lib/sms/ctas.ts`); freeform → 1:1 human inbox with keyword-suggested reply links | Single-turn only. No state, no follow-up questions, no geo awareness — VOTE returns the same generic `/vote` link to everyone |
| **Audience dimensions** | subscribers (opt-in ledger), volunteers, Clerk roles, volunteer role/door tags, captain team (`web/lib/sms/audiences.ts`) | No county, no ZIP, no school district |
| **Voter data** | 577,366-voter MO-02 file in DynamoDB, sharded by `county#precinct`; fields include `county`, `zip` (ZIP5), `precinct`, township/ward; T/S scores + segments (`web/lib/voters/score.ts`) | **No school-district column exists in the voter file** — it must be derived (see §6) |
| **Targeting bridge** | Ranking core `buildSendList()` shipped (`web/lib/reports/smsTargeting.ts`, Phase 3 of `candidate/sms-targeting-plan.md`) | Phases 1–2, 4–5 (enrichment job, composer targeting, GOTV chase mode, feedback loop) still unshipped — this plan absorbs and extends them |
| **Early-vote content** | `candidate/absentee-voting-guide.md` + `/vote/absentee` page; GOTV templates; `candidate/early-vote-sites-seed.csv` (12 candidate sites) | `/vote/absentee` page now lists **all six counties** (corrected in #368 to match the guide's 2026-07-10 six-county update); the 12 early-vote sites remain unverified/ungeocoded |

**The non-negotiable constraint (unchanged):** the voter file is never broadcast-texted. SMS reaches only the `SMSCONSENT` opt-in ledger; the build-failing guard `web/lib/sms/audiences.voterfile-isolation.test.ts` forbids any `lib/sms/` module from reading voter partitions. Everything below preserves that wall.

---

## 2. Architecture: Geo Without Breaking the Wall

Two geo sources, both landing as **plain denormalized fields on the consent/conversation rows** so the send path never reads a voter partition:

1. **Self-reported ZIP (primary, immediate).** The SMS agent asks for it. A ZIP volunteered by the subscriber in-conversation has no voter-file lineage at all — cleanest possible provenance, and it powers the conversational replies the same day.
2. **Enrichment job (batch, out-of-band).** The already-planned `scripts/` job (sms-targeting-plan §2) that tags opted-in rows with `voterSegment`/`voterT`/`banked` is extended to also write `county`, `zip`, and derived `schoolDistrict`. Scripts may read both sides; `lib/sms/` still reads only consent rows.

```mermaid
flowchart LR
  subgraph Inbound["Conversational (real-time)"]
    A[Text VOTE / EARLY] --> B{ZIP known?}
    B -- no --> C["Ask: Reply with your 5-digit ZIP"]
    C --> D[ZIP received → save on convo + consent row]
    B -- yes --> E
    D --> E["County-specific reply: early-vote site, window, mail deadline, /vote/absentee link"]
  end
  subgraph Batch["Targeting (out-of-band)"]
    V[(Voter file)] -->|scripts/ enrichment job only| S[(SMSCONSENT rows + county/zip/segment/T/banked)]
    X[ZIP↔district crosswalk] --> S
    S --> F["Composer geo filters: county / zip / school district"]
    F --> G[buildSendList ranking → campaign queue → cron drain]
  end
  D -.->|self-reported zip| S
```

---

## 3. Phase 0 — The Send Today (July 26)

Uses only shipped machinery — no code required. Send during the 9am–8pm CT window via `/dashboard/sms`.

> **Two deadlines have PASSED and must never appear in copy again:** voter registration (Jul 8) and the
> by-mail ballot application (5pm Wed Jul 22). Earlier drafts of this section pushed the mail deadline —
> sending that now would misinform voters. What remains: **in-person early voting through 5pm Mon Aug 3**
> and **Election Day Tue Aug 4, polls 6am–7pm**.

**Run the pre-flight first** — it prints the real opted-in count, cost, chunk count, and completion ETA:

```bash
cd web && DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 npm run sms:preflight -- --budget 250
```

**Today's send.** Template: **Early-vote push** (its phrasing tracks the calendar automatically), audience
**All opted-in**, `{first}` personalization on. Rendered body — one GSM-7 segment including the suffix:

> Vote early through 5pm Mon Aug 3. Photo ID, no excuse needed. Reply VOTE for where to go. - Paid for by Matt Grant for Congress. Reply STOP to opt out.

**Ops checklist (from `web/docs/sms-operator-runbook.md` / `sms-go-live.md`):**
1. Confirm the three Twilio secrets are present and Toll-Free Verification reads **Verified** (error 30032 otherwise). The pre-flight reports the secrets; verification status must be checked in the Twilio console.
2. Audience: **All opted-in**. An early-vote *information* message should reach the whole list — it is the cheapest banked-vote generator we have. Ranking still queues the highest-likelihood voters first, and a budget cap trims only the lowest-priority tail.
3. Mandatory self-test send. Confirm the composer's segment counter reads **1 segment** and flags no non-GSM characters — a single curly quote or em dash doubles the cost of the entire blast.
4. Staff the inbox: every "Reply VOTE" lands as a 1:1 conversation with the county-aware agent. Watch opt-out rate between sends (<2% healthy, >5% stop — `messaging/sms-texting.md` §8).

---

## 4. Phase 1 — The VOTE Agent: ZIP-Aware Multi-Turn Replies

> **Shipped 2026-07-20.** `web/lib/sms/votebot.ts` (replies + parsing + question expiry) and `web/lib/sms/geo.ts` (six-county registry + verified ZIP starter map, compiled from `candidate/absentee-voting-guide.md`), wired into the Twilio webhook. One refinement from the design below: the agent asks for the **county name first** (ZIP also accepted) — county-name matching needs no crosswalk and can't be wrong, while the ZIP map starts with only ZIPs verifiable from campaign reference material and grows via the §6 crosswalk task. Self-reported geography is stored on both the conversation and the consent row, pre-seeding Phase 2 targeting.

The core "phone number can communicate with the SMS agent" upgrade. Deterministic, compliant by construction, no AI required.

**Flow:**
- `VOTE` (aliases `VOTING`, add `EARLY`, `EARLYVOTE`) → if the conversation already has a stored ZIP, reply immediately with county-specific info; else reply: *"Which county are you in? Reply with your 5-digit ZIP and we'll text your early-voting location. Early voting runs July 21-Aug 3."*
- Inbound 5-digit number while the conversation is awaiting a ZIP → store it → reply with that county's election authority name + phone, the early-vote window/hours note, the July 22 mail deadline (through July 22), and the UTM-tagged `/vote/absentee` link. Unknown/out-of-district ZIP → polite fallback with the generic guide link.
- STOP/START/HELP keep absolute priority (matched first in the route, unchanged).

**Code changes:**
1. `web/lib/sms/votebot.ts` (new) — pure functions: `voteReplyForZip(zip5)`, `askZipReply()`, `isZipCandidate(body)`. Every reply built like `ctaReply()` so disclaimer + STOP are appended by construction.
2. `web/lib/sms/geo.ts` (new, static data) — MO-02 ZIP5 → county map and the six-county info table (authority name, phone, from `candidate/absentee-voting-guide.md`: St. Louis County, Franklin, Jefferson, Washington, Crawford, Gasconade). Static data compiled from the absentee guide — **not** a voter-file read, so the isolation test stays green; add a comment saying so.
3. `web/lib/sms/conversations.ts` — add optional `pending?: "zip"` + `zip?: string` to the `SMSCONVO` row; expire `pending` after ~24h so a stray 5-digit text later isn't misread.
4. `web/app/api/webhooks/twilio/route.ts` — after reserved words and CTAs: if body is a ZIP candidate and convo `pending === "zip"`, run the votebot; VOTE CTA routes to the votebot instead of the static link. Also mirror the ZIP onto the consent row (`zipSource: "self-reported"`), which pre-seeds Phase 2 targeting.
5. Tests mirroring `ctas.test.ts`: keyword precedence (STOP beats ZIP), ZIP parsing, county mapping, disclaimer presence on every reply, pending expiry, isolation test still passing.

**Data prerequisite:** verify each county's early-vote sites/hours by phone before texting specifics (all 12 rows of `candidate/early-vote-sites-seed.csv` are marked unverified and ungeocoded; `candidate/early-vote-site-verification-checklist.md` is the checklist). Until verified, replies name the county election authority + phone number rather than a specific site address.

---

## 5. Phase 2 — Geo Targeting in the Broadcast Composer

> **Shipped 2026-07-20.** The enrichment job (`web/scripts/enrich-sms-audience.ts`, `npm run enrich:sms`, pure core + tests in `web/lib/reports/smsEnrichment.ts`) tags opted-in consent rows with `voterSegment`/`voterT`/`banked`/`county`/`zip`; the composer gained "Narrow by county / voter tag" chips (six counties, segments, "Not yet voted") plus a free-form ZIP filter, resolved entirely from consent-row fields (`parseTargetToken`/`smsTargetCounts` in `web/lib/sms/audiences.ts`). Self-reported geography from the vote agent carries `geoSource: "self"` and always beats a voter-file match. The isolation guard still passes — `lib/sms/` reads no voter surface. This also delivers sms-targeting-plan Phases 1, 2, and 4.

Extends sms-targeting-plan Phases 1–2 with geography, one job + one filter surface:

1. **`web/scripts/enrich-sms-audience.ts` (the planned Phase-1 job, now geo-aware).** Out-of-band; allowed to read both sides. Match each opted-in number to a voter record (voterId when known, else name+ZIP5 per `voter-file-plan.md` §3) and denormalize onto the consent row: `voterSegment`, `voterT`, `banked`, **`county`, `zip`**, and `schoolDistrict` via the §6 crosswalk. Self-reported ZIP (Phase 1) wins over matched ZIP on conflict — the subscriber's own answer is fresher. Re-run nightly during GOTV to refresh `banked` from ballot-return data.
2. **`web/lib/sms/audiences.ts` — namespaced geo tokens**, same pattern as `role:`/`door:`: `county:Franklin`, `zip:63011`, `district:<crosswalk-name>`, plus sms-targeting-plan's `segment:MOBILIZE` / `t>=4` / `outstanding`. Filters only *narrow* the opted-in audience; reads only consent-row fields, so the voterfile-isolation guard still passes. Composer shows live counts per token (existing `smsAudienceCounts` pattern).
3. **GOTV chase mode (Phase 4 of the targeting plan):** `excludeBanked` in the composer so late-window sends skip people who already voted early — pairs with `tactics/ballot-chase-program.md` daily banked updates ("remove from lists by 10 AM").

---

## 6. Phase 3 — School-District Layer (Derived Geography)

> **Infrastructure shipped 2026-07-20; data generation is the one remaining (operator) step.** Trusted sources confirmed: the **NCES EDGE School District Geographic Relationship Files** (district↔county + district↔ZCTA tables, https://nces.ed.gov/programs/edge/geographic/relationshipfiles) as the crosswalk product, name-verified against the **Missouri DESE** School Directory (https://dese.mo.gov/directory) / DESE boundary layer (https://gis.mo.gov/arcgis/rest/services/DESE/Missouri_Public_Schools/MapServer, layer 1). The remote sandbox's network policy blocks both hosts, so `web/scripts/build-school-district-crosswalk.ts` (`npm run build:district-crosswalk`) runs against locally downloaded GRF files: it filters Missouri LEAs to the six MO-02 counties by **exact** county name ("St. Louis city" can never match "St. Louis County"), preserves multi-district ZIPs as ambiguous, fails loudly on header mismatch, and regenerates `web/lib/sms/school-districts.data.ts` with full provenance. Until then the data module ships **empty** — `SCHOOL_DISTRICT_DATA_READY` is false, district chips stay hidden, and enrichment writes no district. Everything downstream is already wired: the enrichment job derives `schoolDistrict` from any row's ZIP (self-reported included) via `districtForZipUnambiguous()` — never from an ambiguous ZIP — and the composer gains `district:<LEAID>` chips automatically once counts are non-zero.

The voter file's 36 columns include congressional/legislative/senate districts, county, precinct, and ZIP — **no school district**. School district must be a derived attribute:

1. **Build a crosswalk data file** (`web/lib/sms/school-districts.ts` or a JSON asset): ZIP5 → school district(s) for the six MO-02 counties. Source it from Missouri DESE district boundary data / U.S. Census SDUSD shapefiles — do not guess district names or boundaries; this is a data-acquisition task with the source and verification date recorded in the file header and `references/update-log.md`.
2. **Handle the honest limitation:** ZIPs cross school-district lines. Mark multi-district ZIPs as ambiguous; a precinct→district mapping (voter file has precinct) is the accurate upgrade when a precinct crosswalk is obtainable from county GIS. Never present an ambiguous match as certain in targeting counts.
3. **Use it for geographic relevance only** — e.g., routing a subscriber to the early-vote site or event nearest their community, or captain turf organized by district. Per `CLAUDE.md`, school-district targeting must **not** be used to imply local education policy positions beyond `candidate/platform.md`'s documented four priorities.

---

## 7. Phase 4 (Optional, Post-Primary Candidate) — AI Conversational Layer

Today freeform texts go to the human inbox — correct for a campaign. If conversational AI is added, do it in this order: (a) **draft-assist**: Claude drafts a suggested reply inside the staff inbox, grounded *only* in `candidate/absentee-voting-guide.md`, `candidate/platform.md`, and `messaging/sms-texting.md` §7 canned replies — human taps send; (b) only after that proves accurate, auto-answer a small allowlist of intents (early-vote logistics, polling place, HELP-adjacent) with everything else still escalating to a human. Hard rules regardless: never auto-reply to opted-out/blocked numbers, disclaimer on every outbound, full logging to the thread, no fundraising asks generated by the model, and the moderation flags (`flagProfanity`) always route to a human. Given the Aug 4 timeline, phases 0–2 matter more; do not block them on this.

---

## 8. Send Calendar — July 26 → August 4 (4-3-2-1 Aligned)

Cadence per [`../workflows/gotv-plan.md`](../workflows/gotv-plan.md) (4 days out → Election Day) and the
chase waves in [`../tactics/ballot-chase-program.md`](../tactics/ballot-chase-program.md). Daily GOTV in the
final week is explicitly within `messaging/sms-texting.md` §8 guidance. Every template below renders as
**one GSM-7 segment** including the compliance suffix — verified by
`web/lib/sms/templates.test.ts`.

| Date | Template | Preset / audience | Why |
|---|---|---|---|
| **Sun Jul 26 (today)** | Early-vote push | All opted-in | Widest reach on the cheapest banked-vote message |
| Mon Jul 27 | *(hold)* | — | Don't stack two sends back-to-back; let opt-out rate settle |
| Tue Jul 28 | Shift reminder | Volunteers | Field logistics, not GOTV — keep it off the main list |
| Wed Jul 29 | Early-vote push | GOTV chase (`gotv-chase`) | Second early-vote touch, already-voted suppressed |
| **Thu Jul 30** (4 days) | GOTV reminder | GOTV chase | 4-3-2-1 begins — "make your plan" |
| **Fri Jul 31** (3 days) | Early-vote push | Top priority, not yet voted | Weekend is the last realistic early-vote window for working voters |
| **Sat Aug 1** (2 days) | Early-vote push | Not yet voted, ranked | Saturday hours vary by county — the VOTE reply carries specifics |
| Sun Aug 2 | *(hold)* | — | Most county offices closed; save the touch |
| **Mon Aug 3** (1 day, morning) | **Last day of early voting** | Not yet voted | Hard 5pm cutoff — the last chance to bank a vote |
| **Tue Aug 4 (morning)** | **Election Day chase** (blank phase) | Not yet voted | Polls open 6am–7pm |
| **Tue Aug 4 (after 4pm)** | **Election Day chase** (`closing`) | Not yet voted | "The last two hours matter most" (`gotv-plan.md`) |

**Two things to check before each send**, both from `npm run sms:preflight`:

- **The completion ETA.** At the default ~30/min inside a 9am–8pm CT window, a large audience can run past
  8pm and finish the *next* day. On Aug 4 that means arriving after polls close. Cut the audience, raise
  `SMS_DRAIN_BATCH` / `SMS_DRAIN_BATCHES_PER_RUN`, or start earlier.
- **Opt-out rate since the last send.** Under ~2% healthy · 2–5% review targeting and frequency · over ~5%
  stop and diagnose before sending again.

Suppression matters more each day: from Jul 29 on, every send uses a **not-yet-voted** preset so a text is
never spent on someone whose ballot is already banked. That requires the daily county returns import at
`/dashboard/voters/chase` — without it, `banked` is never set and the chase presets fall back to the full
list.

---

## 9. Small Fixes to Land Alongside (each is an easy PR)

1. ~~**Add Franklin County to `web/app/(site)/vote/absentee/page.tsx`**~~ — **done 2026-07-20** (county list, `AUTHORITIES`, and footer now carry all six counties per the guide's 2026-07-10 correction).
2. ~~Add `EARLY` / `EARLYVOTE` aliases to the VOTE CTA in `web/lib/sms/ctas.ts`~~ — **done 2026-07-20**.
3. ~~Add an `early-vote` template to `web/lib/sms/templates.ts`~~ — **done 2026-07-20** (calendar-aware phrasing: "starts Tue July 21" → "open now through 5pm Mon Aug 3" → Election Day, with a Reply VOTE hook into the agent).
4. Verify + geocode the 12 rows in `candidate/early-vote-sites-seed.csv` per the verification checklist.
5. Optionally add the Aug 4 primary voting calendar to `states/missouri/` reference files (currently the dates live only in `candidate/` and the web pages).
6. ~~Interactive SMS spend calculator~~ — **done 2026-07-20**: admin-gated **Spend decider** page at `/dashboard/sms/spend` (Comms menu; `sendSms` capability). Pure model in `web/lib/reports/smsSpend.ts` (+ tests); live opted-in and segment counts prefill; returns the composer's Max texts cap and a priority coverage table. Twilio pricing defaults verified July 2026 and must be re-verified before budgeting.

---

## 10. Compliance Guardrails (Unchanged and Restated)

- **Opt-in is the only gate.** Geo/segment targeting only narrows the opted-in audience; opt-in and block status are re-checked per recipient at send time (`drainSmsOnce`).
- **The TCPA wall stands.** `lib/sms/` never reads voter partitions (build-enforced); voter-file/appended phones remain manual-dial call sheets only (RSMo §115.157 political-use custody per `candidate/voter-file-plan.md`).
- **Quiet hours** 9am–8pm CT for broadcasts; conversational replies to a person's own inbound message send immediately (confirmations of their own action).
- **Disclaimer on everything:** "Paid for by Matt Grant for Congress." + STOP auto-appended (52 USC 30120 / 11 CFR 110.11 per `federal/digital-advertising.md`).
- **Counts, not lists**, in all reports; no PII in git; self-reported ZIPs stored only on consent/convo rows.
- **No invented facts:** every date/site/hours texted must trace to `candidate/absentee-voting-guide.md` or a county election authority verification; school-district names only from the sourced crosswalk.

## 11. Verification Plan

- Unit: votebot ZIP parsing/county mapping/disclaimer-on-every-reply; keyword precedence (STOP > ZIP capture); pending-state expiry; geo token parsing and count helpers; enrichment precedence (self-reported ZIP wins).
- The existing `audiences.voterfile-isolation.test.ts` must stay green with `geo.ts`/`votebot.ts` added — the static county table must not import any voter surface.
- End-to-end (per `web/docs/sms-go-live.md`): opt own number in → text VOTE → answer ZIP → receive county reply; STOP then VOTE → no reply; composer send filtered to `county:Franklin` matches the count preview.

---

*This is educational information, not legal advice. Consult a campaign finance attorney or your filing agency for guidance specific to your situation. Election dates verified against public sources July 20, 2026, and `candidate/absentee-voting-guide.md` (re-checked 2026-07-10); confirm hours and sites with each county election authority before publishing them in texts.*
