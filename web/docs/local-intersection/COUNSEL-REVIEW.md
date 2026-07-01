# Local Issue Intersection — Counsel Review One-Pager

**For:** campaign counsel · **From:** engineering · **Re:** approving the AI-generated
portion of a new feature on `mattgrantforcongress.org/issues/<topic>`.
**Read time:** ~5 min. Full detail: `SPEC.md` (same folder).

---

## What the feature does (plain English)

On each issue page, a visitor can enter their **ZIP code** and see:

1. **Verified public data for their area** — a few figures pulled directly from the
   U.S. Census (e.g., median household income), each shown **with its source
   citation**.
2. **Matt's position on that issue** — his existing, documented commitment.

A planned **later** step would add an AI-written paragraph that *personalizes* how
the issue applies to the visitor's area.

## What is LIVE today vs. what needs your sign-off

| | Status | Involves AI? | Risk |
|---|---|---|---|
| Verified Census figures + citations | **Live** | No | Public gov data, sourced |
| Matt's documented commitment (verbatim) | **Live** | No | His own published position |
| **AI "how this applies to your area"** | **Held — needs your OK** | **Yes** | The subject of this review |

Nothing generating text has shipped. The live widget only *displays* public data and
Matt's own words.

## Why we're asking counsel

An AI paragraph tailored to a locality could, if unconstrained, (a) imply a position
or promise Matt has **not** made, (b) make an assertion about a **local institution**
(a court, school board, official) that could be false or defamatory, or (c) mishandle
the **pending family-court litigation**. We have engineered controls to prevent each;
we want your confirmation they are sufficient before enabling generation.

## The controls (what limits the risk)

1. **Two-layer separation.** The AI never sources its own facts. It receives only
   (i) Matt's documented platform and (ii) the same verified, pre-cited Census
   figures shown on screen. It may reference those and nothing else.
2. **Documented-positions-only.** Hard rule: the AI may not state or imply any
   position, promise, or judgment not already in Matt's published platform.
3. **No local characterizations.** The AI may not name or characterize any local
   official, court, school, board, budget, or meeting — it speaks generically ("your
   county commission," "a public meeting").
4. **Pending-lawsuit framing.** Any reference to the family-court matter is framed as
   **alleged/pending, never as established fact** (already enforced site-wide).
5. **Lawful civic action only.** Recommendations are limited to educating, attending
   public meetings, and voting — never anything improper.
6. **FEC disclaimer.** Every output carries **"Paid for by Matt Grant for
   Congress."** plus an education-only, not-legal-advice line.
7. **Fail-closed.** On any uncertainty (model error, bad data), the system returns
   **human-authored, platform-faithful** content instead — it never fabricates.
8. **Automated gate.** Generation cannot ship until a test suite of allowed/forbidden
   examples passes, blocking outputs that invent positions, locals, or figures.

## Specific decisions we need

1. **Approve** the controls above (§SPEC 5 + 7) as sufficient to enable AI generation.
2. **Approve** the **family-court framing** specifically (pending-litigation language).
3. **Confirm** the disclaimer language is adequate, or provide preferred wording.
4. **Flag** any additional constraint you want encoded before we build the AI layer.

## What counsel does NOT need to weigh

- The **Census figures** (public government data, cited) and the **verbatim documented
  commitment** — no new claim is generated; these are already live and low-risk.

---

*Approving this unblocks engineering to build the AI layer against these constraints;
it will return for a final review of real sample outputs before going live.*
