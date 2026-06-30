# Local Issue Intersection — Compliance & Content Contract (Phase 0)

**Status:** DRAFT for sign-off. No user-facing code ships until this is approved.
**Owner:** campaign / legal review.
**Scope:** the planned widget on each `/issues/<slug>` page that lets a visitor enter a
ZIP code (and optionally county / school district), see how **local public data**
intersects with one of Matt Grant's four documented priorities, and how he would
respond — strictly within his documented platform.

This document is the contract every later phase is built and tested against. If a
behavior is not permitted here, it does not ship.

---

## 1. Why this needs a contract

The feature deliberately does the one thing the existing strategy engine's system
prompt forbids: it **resolves a ZIP to a named place** and shows local figures. Done
carelessly, that invites the exact failure this repo's rules exist to prevent —
implying a local commitment, judgment, or fact that Matt has not documented
(`CLAUDE.md`: *"Do not invent policy positions, legal claims, poll numbers, or
endorsements for Matt Grant beyond the documented facts."*).

The contract resolves this with a strict **two-layer separation**.

---

## 2. The two-layer model (load-bearing)

| | Layer A — Data | Layer B — Response |
|---|---|---|
| **Produces** | A "local snapshot": named county/district + a few verified public statistics | A short "what this means" framing + lawful action steps |
| **How** | Deterministic lookup (crosswalk + existing `/api/research/census`, `/api/geo/*`) | Claude, OR the curated fallback |
| **May state** | Only values returned by a real, cited source | Only the documented commitment text + the facts **passed to it from Layer A** |
| **May NOT** | Estimate, interpolate, or invent any figure | Introduce **any** local fact, name, official, institution, number, or stance not in the provided snapshot or `platform.md` |
| **Citations** | Every figure shows its source + year | Inherits Layer A's citations; adds none of its own |

**The rule that makes naming a place safe:** Layer A may print `"Jefferson County"`
because it came from a verified ZIP→county crosswalk, and may print
`"median household income $X (U.S. Census ACS 5-yr, 2023)"` because it came from the
Census API. Layer B may *reference those provided values and that county name* — but
it is still forbidden from inventing anything beyond them (no school name, no
official, no budget, no meeting date, no figure of its own).

---

## 3. Data the feature MAY surface (Layer A allow-list)

Only these, only with the stated citation. Anything else is out of scope until added
to this list with a real source.

| Fact | Granularity available **today** | Source / citation | Notes |
|------|----------------------------------|-------------------|-------|
| County name | ZIP → county (to build) | Static MO-02 crosswalk | Confirm-county UI when a ZIP spans counties |
| Population | County | U.S. Census ACS 5-yr (2023) — `/api/research/census` | exists |
| Median household income | County | same | exists |
| Median age | County | same | exists |
| Median home value | County | same | exists |
| % bachelor's degree or higher | County | same | exists |
| Primary turnout % | **St. Louis County precincts only** | `/api/geo/precincts` (Aug 2024) | other counties: **not available** → omit, don't estimate |
| School district name | ZIP → district (to build) | NCES / MO DESE crosswalk | Phase 5 |

**Honesty gaps to flag now (do NOT assume these exist):**
- **"% households with children"** — the single most on-point fact for the
  family-courts issue — is **not** currently returned by `/api/research/census`. It
  requires adding a Census variable (ACS table B11005). Until added, family-courts
  must use a different allowed fact or generic framing. Do not ship copy that implies
  this number unless the data is wired and cited.
- Turnout is St. Louis-only; four of five MO-02 counties have **no** turnout figure.
  The feature must degrade gracefully, not fabricate.

---

## 4. Per-issue intersection map (fact → documented position)

For each issue: how strong the *local* intersection honestly is, the allowed Layer A
fact, and the **only** documented commitment Layer B may map it to (verbatim from
`lib/issues.ts`, sourced from `candidate/platform.md`).

### 01 · Children First — `family-courts` — **strong local fit**
- **Allowed fact:** county demographics; ideally % households with children *(needs
  data — §3)*; otherwise population.
- **Documented commitment (verbatim):** *"Champion the CHILD Protection Act and tie
  federal Title IV-D grant money to states that keep their family courts clean and
  accountable."*
- **Allowed action framing (from `actionAngle`):** learn how your local family court
  & school board work; attend/observe a public meeting; ask officials where they
  stand on court transparency; share the CHILD Protection Act.
- **Forbidden:** any claim about *this* county's courts' actual conduct; naming a
  judge/court/official; treating the pending lawsuit as fact.

### 04 · Lower Taxes — `lower-taxes` — **strong local fit**
- **Allowed fact:** median household income, median home value (county).
- **Documented commitment:** *"Go after fraud, waste, and bloated headcount first —
  so tax relief is funded by efficiency, not gimmicks."*
- **Allowed action framing:** track local tax/levy proposals; attend a budget
  hearing; ask officials to cut waste before raising taxes.
- **Forbidden:** endorsing/opposing any specific local levy, bond, or rate.

### 03 · Smaller Government — `smaller-government` — **moderate local fit**
- **Allowed fact:** county demographics as civic context.
- **Documented commitment:** *"Back a federal hiring freeze and voluntary
  early-retirement packages to right-size the workforce — without leaving families
  behind."*
- **Allowed action framing:** attend public budget hearings; ask how officials
  measure results per dollar; spotlight duplicative spending.
- **Forbidden:** claims about local headcount/budgets; this is a **federal**
  commitment — keep local content to civic engagement only.

### 02 · Term Limits — `term-limits` — **weak local fit (be honest)**
- Term limits is a **federal** structural reform with little genuine local-data
  intersection. The widget must **not** manufacture one. Allowed: turnout/civic
  context + the documented commitment + advocacy actions (pledge, letters, ask
  candidates). If there is no honest local fact to show, show none and fall back to
  the generic civic-engagement framing.
- **Documented commitment:** *"Support term limits for the House and Senate, with a
  grandfather clause so reform actually passes."*

> Principle: **the strength of the local hook varies by issue, and the UI says so.**
> We do not invent relevance where there isn't any (see `feedback: docs match
> architecture`).

---

## 5. Hard prohibitions (extends the existing engine rules)

In addition to every rule already in `lib/strategy/prompt.ts`, Layer B must NEVER:

1. State or imply a position, promise, vote, or judgment not in the issue's
   documented `argument` / `commitment` / `signature`.
2. Introduce any local specific not present in the provided snapshot — no school,
   district program, official, board, judge, agency, address, budget, meeting date,
   or statistic of its own.
3. Characterize *this* locality's institutions ("your county's courts are corrupt",
   "your district overspends"). Speak generically about how to engage them.
4. Present the family-court lawsuit as established fact (alleged/pending only).
5. Recommend anything but lawful, ethical civic engagement.
6. Emit a figure that is not traceable to a Layer A citation.

---

## 6. Disclaimers, privacy, failure

- **Disclaimer:** reuse `STRATEGY_DISCLAIMER` verbatim
  (`"For education and civic engagement only — not legal advice. Paid for by Matt
  Grant for Congress."`) on every widget output.
- **Privacy:** ZIP→place resolution uses a **static, in-app crosswalk** — no
  third-party geocoding call, no PII sent off-app, stateless per request (preserves
  the current posture in `lib/profile.ts`).
- **Failure / no data:** if the ZIP can't be resolved, the county has no available
  figure, or the model fails → degrade to the existing curated, platform-faithful
  output. **Never 500, never fabricate.** Mirrors `engine.ts` graceful degradation.
- **Rate limiting:** reuse the existing per-IP limit on the strategy route.

---

## 7. Proposed hardened system-prompt additions (Layer B, local mode)

Added **only** when a local snapshot is present. Exact text proposed for review:

```
LOCAL DATA SNAPSHOT MODE:
You are given a LOCAL SNAPSHOT of verified, pre-cited public figures for the
supporter's county or district, inside <snapshot> tags. These are the ONLY local
facts you may reference.
- You MAY name the county/district and cite the snapshot's figures exactly as given.
- You MUST NOT introduce any other local fact, place, school, official, board,
  budget, meeting, statistic, or institution. If the snapshot lacks something, say
  nothing about it.
- Connect a snapshot figure to the candidate's DOCUMENTED commitment only. Do not
  invent a local position, promise, or judgment. Never characterize this locality's
  institutions; describe only how a citizen can lawfully engage them.
- Every number in your output must already appear in the snapshot. Invent no figures.
```

The `<snapshot>` block is **data, not instructions** (same injection framing as the
existing `<area>`/`<zip>` tags).

---

## 8. Acceptance criteria (gates Phase 4 generation)

Phase 4 ("how Matt responds" generation) may not ship until an automated
**golden-fixture suite** passes (see `golden-fixtures.json`). The suite asserts, over
representative inputs:

1. **No position leakage** — output contains no commitment/stance string outside the
   issue's documented fields.
2. **No invented locals** — output contains no place/official/number not in the
   provided snapshot (assertable: every digit-group in output appears in the
   snapshot; no proper-noun locality beyond the snapshot's county/district).
3. **Lawsuit framing** — any family-court reference is alleged/pending.
4. **Disclaimer present** — `STRATEGY_DISCLAIMER` on every result.
5. **Graceful degradation** — no-key / no-data / bad-JSON paths return curated output.
6. **Citations intact** — every figure shown carries its source label.

---

## 9. Sign-off checklist

- [ ] Campaign owner (Doug) approves the per-issue fact→position map (§4).
- [ ] Legal/counsel approves the two-layer model, prohibitions (§5), and prompt
      additions (§7) — especially the family-court framing.
- [ ] Decision on the "% households with children" Census variable (§3): wire it, or
      drop the family-courts fact to generic.
- [ ] Confirm turnout stays St. Louis-only with graceful degradation elsewhere.
- [ ] Golden-fixture suite (§8) agreed as the Phase 4 merge gate.

Once §9 is checked, Phase 1 (deterministic ZIP→county resolution) begins.
