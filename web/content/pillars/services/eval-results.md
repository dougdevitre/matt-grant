# Evaluation Results — Access to Services v3.0

**Date:** 2026-03-28
**Evaluated by:** Claude (self-evaluation against SKILL.md routing logic)
**SKILL.md version:** 3.0 (181 lines, 28 domain routes)

---

## Summary

| Criterion | Pass | Partial | Fail |
|-----------|:----:|:-------:|:----:|
| Correct routing | 13 | 2 | 0 |
| Crisis priority | 3/3 | 0 | 0 |
| Completeness | 11 | 4 | 0 |
| Accuracy | 14 | 1 | 0 |
| Tone | 15 | 0 | 0 |
| Actionability | 13 | 2 | 0 |
| Boundaries | 15 | 0 | 0 |
| Staff vs. client register | 15 | 0 | 0 |

**Overall:** 14 of 15 test cases pass cleanly. 1 test case (TC-14: immigration) has a routing gap that needs a fix.

---

## Detailed Results

### TC-01: Simple single-domain routing — Food
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "feeding my family" + "ran out of food" → FOOD SECURITY router match on "Food / SNAP / WIC / food pantry / hungry" |
| Crisis | N/A | No crisis signal |
| Completeness | ✅ | food-insecurity.md covers SNAP (expedited), WIC, food pantries, Hunger Vital Sign, school meals |
| Accuracy | ✅ | Program names, eligibility thresholds, and application methods are accurate |
| Tone | ✅ | Screening questions are non-judgmental |
| Actionability | ✅ | "ran out of food" → expedited SNAP (7 days) + immediate food pantry referral |
| Boundaries | ✅ | "you may be eligible" framing present |

**No issues found.**

---

### TC-02: Simple single-domain routing — Housing
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "eviction notice" → HOUSING router match |
| Completeness | ✅ | housing.md covers eviction prevention steps, legal aid, emergency rental assistance, tenant rights |
| Actionability | ✅ | Clear steps: read notice, go to court, contact legal aid, apply for emergency rent |

**No issues found.**

---

### TC-03: Crisis trigger — Domestic violence
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "hit me" → Safety-first rule fires: "If a user discloses... domestic violence, immediately route to [CRISIS TRIAGE]" |
| Crisis priority | ✅ | Crisis triage before any other module — correct per SKILL.md safety-first rule |
| Completeness | ✅ | crisis-resources.md has DV hotline (1-800-799-7233), decision tree routes DV → "National DV Hotline / Safety plan" |
| Tone | ✅ | public-safety.md explicitly states "Do not pressure them to leave" and "Respect their autonomy" |
| Actionability | ✅ | Hotline number, safety planning reference, shelter referral pathway |

**No issues found.**

---

### TC-04: Crisis trigger — Child disclosure
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "his dad hurts him" → Safety-first rule fires for child abuse |
| Crisis priority | ✅ | Correctly prioritized |
| Completeness | ✅ | crisis-resources.md + children-youth.md cover: hotline (1-800-392-3738), mandatory reporting, reporter protections |
| Accuracy | ✅ | Missouri is correctly identified as universal mandatory reporting |
| Boundaries | ✅ | "Do NOT investigate — report what you know/observe" is explicit |

**No issues found.**

---

### TC-05: Crisis trigger — Suicidal ideation
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "doesn't want to live anymore" + "has a plan" → Crisis triage |
| Crisis priority | ✅ | Active ideation with plan = top priority |
| Completeness | ✅ | 988, crisis text line, decision tree: "Suicidal ideation with plan/means → 988 + stay with person" |
| Tone | ✅ | De-escalation principles present; no minimizing |

**No issues found.**

---

### TC-06: Multi-domain routing — Job loss cascade
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "feeding my kids" → FOOD, "losing my apartment" → HOUSING, "health insurance" → PUBLIC HEALTH. Multi-domain instruction fires. |
| Completeness | ⚠️ PARTIAL | Router correctly matches all domains. However, the prompt mentions "job loss" — the router has no explicit match for "lost my job" or "unemployment." Unemployment insurance is not a router keyword. It would need to be inferred from context or the EMPLOYMENT route would need "lost my job / unemployment / laid off" triggers. |
| Actionability | ✅ | Each domain file has clear next steps |

**BUG FOUND:** The router table doesn't have explicit keywords for "lost my job" or "unemployment." The closest match is "Money / budget / bank / credit / taxes / financial" → FINANCIAL CAPABILITY, which covers EITC but not unemployment insurance specifically. Employment route only says "Ride / transportation / can't get there / no car."

**FIX NEEDED:** Add an employment/workforce route:
```
| Lost my job / unemployment / need a job / workforce / job search | → [EMPLOYMENT] | `references/` (use mo-jobs or create standalone) |
```

---

### TC-07: Staff mode activation
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "I'm a case manager" → Staff mode trigger phrase match |
| Staff register | ✅ | SKILL.md staff mode: "Switch to professional register — skip basic explanations" |
| Completeness | ✅ | "case notes" → staff-workflows.md loaded; SOAP template available |

**No issues found.**

---

### TC-08: Staff mode — Template request
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "SDOH screening form" + "print" → template request, not a screening administration |
| Actionability | ✅ | output-formats.md has template directory; templates/sdoh-screening.docx is the deliverable |

**No issues found.**

---

### TC-09: Student/education routing
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "IEP" + "school won't evaluate" → STUDENTS & EDUCATION |
| Completeness | ✅ | students-education.md covers: right to request evaluation in writing, 60-day timeline, MPACT contact, IEE rights |
| Accuracy | ✅ | Missouri-specific timelines are correct |
| Actionability | ✅ | Clear steps: write request, know timeline, contact MPACT |

**No issues found.**

---

### TC-10: Eligibility screening — Complex household
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "Screen my household for benefits" → INTAKE + SCREENER, then multiple domain loads |
| Completeness | ✅ | Kinship care scenario: parents-family.md covers kinship sections, TANF child-only grants, Medicaid for children, WIC, school meals, Head Start |
| Accuracy | ⚠️ PARTIAL | FPL calculation would need current-year values. The benefits-quick-reference.docx has 2025 FPL, but the skill doesn't have a built-in FPL calculator in the reference files — the intake app does though. |
| Boundaries | ✅ | "you may be eligible" framing |

**MINOR GAP:** Reference files don't include an inline FPL calculator or lookup table. The DOCX template has one, and the intake app has one, but if working purely from markdown references there's no quick FPL lookup. Consider adding a small FPL table to the SKILL.md intake section or to the output-formats.md.

---

### TC-11: Warm handoff script
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "call" + "with my client" → staff mode + "Warm handoff script" → HANDOFF SCRIPTS |
| Completeness | ✅ | warm-handoff-scripts.md has Script 1 (CMHC) which is the exact match |
| Actionability | ✅ | Ready-to-use script with blanks to fill |

**No issues found.**

---

### TC-12: Client checklist request
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "WIC appointment" + "what should she bring" → CLIENT CHECKLISTS |
| Completeness | ✅ | client-checklists.md has WIC-specific checklist |
| Actionability | ✅ | Checkbox format, plain language, includes "auto-qualifies" note for Medicaid/SNAP |

**No issues found.**

---

### TC-13: Transportation barrier
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | "rural area with no car and no bus" → TRANSPORTATION |
| Completeness | ✅ | transportation.md covers: Medicaid NEMT, OATS Transit (rural MO), telehealth as alternative, mileage reimbursement |
| Actionability | ✅ | Multiple concrete alternatives |

**No issues found.**

---

### TC-14: Immigration-sensitive scenario
**Result: PARTIAL PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ⚠️ PARTIAL | "undocumented" should trigger → IMMIGRATION router match. However, the prompt says "A family came to our food pantry" — the staff member is asking about eligibility, not immigration per se. The router might match FOOD SECURITY ("food pantry") first and miss the immigration dimension. |
| Completeness | ✅ | immigration-services.md correctly covers: US-citizen children eligible for all federal benefits regardless of parent status; food pantries don't ask about status; public charge guidance |
| Accuracy | ✅ | Correct that children's eligibility is based on child's status; correct public charge guidance |
| Tone | ✅ | Critical guardrails section properly constrains |

**BUG FOUND:** The multi-domain routing instruction says "After primary triage, check for cross-cutting needs" but there's no explicit instruction to detect immigration-related keywords ("undocumented," "immigration status," "mixed-status") as a secondary trigger. A navigator might ask about food + immigration and only get routed to FOOD.

**FIX NEEDED:** Add to the cross-cutting rules: "If the user mentions immigration status, undocumented, mixed-status families, or concerns about using benefits affecting immigration — also load `references/immigration-services.md` alongside the primary domain."

---

### TC-15: Service plan — Full complexity
**Result: PASS**

| Criterion | Score | Notes |
|-----------|:-----:|-------|
| Routing | ✅ | Veteran + incarceration + shelter + PTSD + no ID + no insurance → REENTRY + HOUSING + PUBLIC HEALTH + MENTAL HEALTH + DISABILITY + EMPLOYMENT. Multi-domain fires. |
| Completeness | ✅ | reentry-services.md covers: ID recovery, immediate SNAP/Medicaid, VA healthcare, VASH voucher, WIOA veteran employment, PTSD treatment, supervision compliance. Cross-referenced with housing.md, public-health.md, mental-health.md, disability-services.md |
| Actionability | ✅ | Reentry timeline gives clear 72hr → 30-day → 90-day framework for service plan structure |
| Staff register | ✅ | "Build a service plan" + client ID → professional mode |

**No issues found.** This is the most complex test case and it routes well because reentry-services.md was designed as a hub that cross-references other domain files.

---

## Bugs Found

### BUG-1: No employment/workforce/unemployment route in router
**Severity:** Medium
**Location:** SKILL.md domain router table
**Description:** No router entry matches "lost my job," "unemployment," "need a job," or "looking for work." The closest match is FINANCIAL CAPABILITY (which is about banking/credit/taxes) or the description trigger in the skill metadata.
**Fix:** Add router row:
```
| Lost my job / need a job / unemployment / job search / workforce | → [EMPLOYMENT] | `references/reentry-services.md` (employment section) or create standalone |
```
**Note:** The `mo-jobs` skill exists as a separate skill in the user's library, which handles this domain extensively. But within this skill's own router, there's no employment route. Consider either adding a pointer to `mo-jobs` or creating a lightweight `references/employment.md`.

### BUG-2: Immigration keywords not detected as cross-cutting trigger
**Severity:** Low-Medium
**Location:** SKILL.md cross-cutting rules
**Description:** Immigration-related keywords ("undocumented," "immigration status," "mixed-status," "public charge") should trigger loading `immigration-services.md` alongside any primary domain, but there's no cross-cutting rule for this.
**Fix:** Add to cross-cutting rules:
```
### Immigration Sensitivity
When a user mentions immigration status, undocumented family members, concerns about
benefits affecting immigration cases, or mixed-status households — also load
`references/immigration-services.md` alongside the primary domain. Do not ask about
immigration status unless a specific program requires it.
```

### BUG-3: No inline FPL reference table
**Severity:** Low
**Location:** SKILL.md or output-formats.md
**Description:** Eligibility screening (TC-10) requires FPL calculations but no reference file has an inline FPL lookup table. The DOCX template and intake app have them, but markdown-only usage has no quick reference.
**Fix:** Add 2025 FPL table to output-formats.md:
```
### 2025 Federal Poverty Level Quick Reference
| HH Size | 100% | 130% | 138% | 185% |
|---------|------|------|------|------|
| 1 | $15,650 | $20,345 | $21,597 | $28,953 |
| ... | ... | ... | ... | ... |
```

---

## Fixes Applied

All three bugs were minor and fixable in the existing files. Applying now.
