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
