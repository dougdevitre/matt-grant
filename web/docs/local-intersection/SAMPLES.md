# Local Issue Intersection — Layer B Sample Outputs (for sign-off)

**Status:** DARK. This is the review artifact promised in the playbook: **real** AI
outputs from the actual engine, so campaign + counsel can approve before any user
sees generation. Nothing here is live — the engine (`lib/issues/localResponse.ts`) is
wired to no public route or widget.

## How these were generated

The real engine end-to-end: real **Census ACS** data per ZIP (Layer A) → **Claude
Haiku** with the SPEC §7 hardened prompt → the **output guards** (`checkLocalResponse`)
→ **curated fallback** on any violation. Four documented issues × three MO-02 ZIPs
(St. Louis Co. `63131`, Jefferson/Arnold `63010`, rural Gasconade `65066`).

## Results at a glance

| | Count | Meaning |
|---|---|---|
| **AI (passed guards)** | 7 / 12 | shipped as generated |
| **Curated fallback** | 5 / 12 | 3 = term-limits (no honest local hook, by design); 2 = guard caught **figure drift** (a rounded `17,993→18,000`, a derived `3 in 10`) → fell back to clean text |

**Zero** outputs with a leaked figure/official/position reached the "AI" bucket — the
guard rejected every drift and the system degraded to curated. This is the fail-closed
contract working on live output.

> Calibration found via these samples: the guard initially rejected the model naming
> the visitor's own ZIP (`63010`) as an "invented figure." Fixed — the verified ZIP is
> now allowlisted. (Exactly what dark sampling is for.)

## Sample AI outputs (verbatim)

**family-courts · ZIP 63131** *(AI)*
> In ZIP 63131, 36% of households include children—families whose futures depend on a
> family court system that puts kids first. Matt Grant's documented commitment is to
> champion the CHILD Protection Act, which would tie federal Title IV-D grant funding
> to state family courts that meet accountability and transparency standards. That
> federal leverage can help ensure courts prioritize children's welfare over
> protecting insiders.
>
> You can help hold your local system accountable: attend or observe a public meeting
> of your county family court or school board, ask officials directly where they stand
> on court transparency, and share Matt's CHILD Protection Act proposal with neighbors.

**lower-taxes · ZIP 63010** *(AI)*
> In ZIP 63010, the median household income is $76,839 and median home value is
> $214,100. Families here feel the weight of taxes on both earnings and property. Matt
> Grant's documented commitment is to go after fraud, waste, and bloated headcount
> first—so tax relief is funded by efficiency, not gimmicks…
>
> You can hold that standard locally: attend your county commission's budget hearings,
> ask officials directly to identify and cut waste and fraud before proposing new
> levies or tax increases, and track how your tax dollars are spent.

**smaller-government · ZIP 65066** *(AI)*
> In ZIP 65066, where 6,021 residents depend on federal services and tax dollars, Matt
> Grant's commitment to a federal hiring freeze and voluntary early-retirement packages
> reflects a belief that Washington should deliver more with smarter spending…
>
> To hold officials accountable for results: attend local budget hearings and ask your
> county commission and federal representatives how they measure what federal spending
> delivers in your area…

**term-limits · any ZIP** *(curated — no honest local hook)*
> Support term limits for the House and Senate, with a grandfather clause so reform
> actually passes.
>
> A lawful next step: learn how your local institutions work, attend a public meeting,
> and turn out to vote in the August 4, 2026 primary.

## What to review (the sign-off questions)

1. **Documented mapping** — each note maps a local figure to Matt's *documented*
   commitment (verbatim policy: CHILD Protection Act / Title IV-D; waste-before-taxes;
   hiring freeze). Confirm none imply an undocumented position.
2. **Family-court framing (the key item)** — the notes describe the *policy mechanism*
   ("penalize corrupt courts," "protecting insiders" — the latter is verbatim from the
   documented argument). They do **not** assert that *this* locality's courts are
   corrupt. Counsel: confirm this framing is acceptable, or tighten it.
3. **Generic local references** — notes say "your county commission," "your county
   family court," "public budget hearings" — never a named official, judge, court,
   school, budget, or ballot measure. Confirm.
4. **Lawful civic action only** — attend/observe/ask/share/vote. Confirm.

## Fail-closed behavior confirmed

- No key / no snapshot / model error / bad JSON → curated.
- Term-limits (federal, no local hook) → curated, never a manufactured local stat.
- Any figure not verbatim from the snapshot (rounding, ratios) → rejected → curated.

**Go-live remains gated:** the flag stays OFF until this is approved. On approval, the
only remaining step is wiring the engine into the widget behind the flag + a final
"flip the switch."
