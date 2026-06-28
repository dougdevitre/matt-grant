# Script Generator — Geo-Targeted, Correctly-Sized Campaign Scripts

Generates Matt Grant's campaign **scripts** — broadcast spots, stump-speech
blocks, social/digital captions, and voter-contact scripts — matched to each of
his four documented priorities across Missouri's 2nd District, and renders them
into one print-ready, on-brand **PDF Script Book**.

Every script is written to a defined **size budget** (run-time in seconds, word
count, or character count) and is checked against that budget at build time, so
a `:30` spot really reads in about thirty seconds and an SMS really fits 160
characters.

## What it produces

`Issue × Geography × Size tier → script → PDF`, where:

- **Issues** (`script_content.py`): the four priorities in `candidate/platform.md`
  — family-court corruption + the CHILD Protection Act, term limits, a smaller
  federal government, and lower taxes. No positions, numbers, or endorsements
  beyond the documented platform.
- **Geographies** (`geo.py`): MO-02 and its five real counties (St. Louis,
  Jefferson, Washington, Crawford, Gasconade), grounded in
  `candidate/data-and-map-plan.md`. Finer detail (school districts, zips,
  courthouses) is intentionally left as a labeled `[…]` merge token, never an
  invented fact.
- **Size tiers** (`sizing.py`): :15 / :30 / :60 broadcast spots, 1 / 3 / 5-minute
  speech blocks, X / SMS / Reel captions, and door / phone / P2P-text scripts.

## Files

| File | Role |
|---|---|
| `sizing.py` | The size standard (run-time / word / character budgets) + `check_length()` QA |
| `geo.py` | The six geographic units + safe localization anchors + `localize()` |
| `script_content.py` | The four issues written to every tier (content-as-data) |
| `script_book.py` | Generator — assembles content and builds the PDF |
| `README.md` | This file |

The generator **reuses** the campaign's branded PDF engine
`../pdf-letterhead/brand_letter.py` (`letter_story`, `build_many`) for the
masthead, body, and the compliant "Paid for by…" footer — it does not
re-implement any PDF layout.

## Requirements

```
pip install reportlab        # same dependency as ../pdf-letterhead/
```

## Usage

```bash
# Full book: all issues × all geographies × all size tiers
python3 script_book.py --out scriptbook.pdf

# Scope it down (flags are comma-separated or repeatable)
python3 script_book.py --issue family-court --format broadcast
python3 script_book.py --geo stlouis,jefferson --tier radio_30,radio_60
python3 script_book.py --format speech --out stump-blocks.pdf

# List every valid key
python3 script_book.py --list
```

Scopes:

- `--issue` `family-court | term-limits | smaller-government | lower-taxes`
- `--geo` `mo02 | stlouis | jefferson | washington | crawford | gasconade`
- `--format` `broadcast | speech | social | voter-contact`
- `--tier` any tier key (e.g. `video_30`, `speech_5`, `social_x`, `door`)

Every run prints a **length-QA report** — each script's measured words /
characters / seconds against its budget, flagged `on size`, `runs long`, or
`runs short`.

## Compliance

- Every page carries **"Paid for by the Matt Grant for Congress Committee."**
  (rendered by the shared PDF footer).
- Broadcast pages include the spoken candidate-approval line and the on-air /
  on-screen "Paid for by…" treatment; social and text tiers carry the disclaimer
  inside the copy (and it counts toward the character limit). Disclaimer language
  follows `tools/disclaimer-generator.md`.
- This is educational information, not legal advice. Confirm the exact
  disclaimer treatment and any Missouri-specific requirements with a
  campaign-finance attorney or your filing agency before airing or publishing.

## Editing

- **Change a script's words:** edit the fragments or authored speech bodies in
  `script_content.py`. Re-run; the QA report tells you if it still fits.
- **Change a size budget or add a tier:** edit `TIERS` in `sizing.py`.
- **Add localization detail:** edit `geo.py`. Keep finer-than-county specifics as
  labeled `[…]` tokens unless the data is real and sourced.
