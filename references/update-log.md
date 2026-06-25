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
