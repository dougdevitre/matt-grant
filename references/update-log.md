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
