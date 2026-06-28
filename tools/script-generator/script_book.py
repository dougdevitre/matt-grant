#!/usr/bin/env python3
"""
Script Book generator — renders geo-targeted, correctly-sized campaign scripts
into one print-ready, on-brand PDF for Matt Grant.

It reuses the campaign's existing branded PDF engine wholesale: the masthead,
the accent-barred RE panel, the sectioned body, and the compliant
"Paid for by…" footer all come from `tools/pdf-letterhead/brand_letter.py`
(`letter_story`, `build_many`). This file only assembles the *content* — one
content dict per (issue × geography × size tier) — and runs a length-QA report.

    Usage:
      python3 script_book.py --out scriptbook.pdf            # full book
      python3 script_book.py --issue family-court --format broadcast
      python3 script_book.py --geo gasconade --tier radio_30
      python3 script_book.py --list                          # show all keys

Scopes (repeatable / comma-separated):
  --issue   family-court | term-limits | smaller-government | lower-taxes
  --geo     mo02 | stlouis | jefferson | washington | crawford | gasconade
  --format  broadcast | speech | social | voter-contact
  --tier    any tier key (e.g. radio_30, speech_5, social_x)

Dependency: reportlab (same as tools/pdf-letterhead/). PDFs are git-ignored.
"""

import argparse
import os
import sys

# Reuse the campaign's branded PDF engine (sibling tool) without duplicating it.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pdf-letterhead"))
import brand_letter as bl  # noqa: E402

from sizing import TIERS, TIERS_BY_KEY, FAMILIES, size_stamp, check_length  # noqa: E402
from geo import GEOS, GEOS_BY_KEY, localize  # noqa: E402
from script_content import ISSUES, get_body  # noqa: E402

FAMILY_LABEL = {
    "broadcast": "Broadcast Spot",
    "speech": "Stump Speech",
    "social": "Social / Digital",
    "voter-contact": "Voter Contact",
}

DELIVERY_LABEL = {
    "broadcast": "On-Air Disclaimer & Production",
    "speech": "Delivery Notes",
    "social": "Disclaimer & Notes",
    "voter-contact": "Notes",
}

EDU_DISCLAIMER = (
    "Educational / compliance note: disclaimer language follows "
    "<i>tools/disclaimer-generator.md</i> and FEC guidance (52 U.S.C. 30120; "
    "11 CFR 110.11), but this is educational information, not legal advice. "
    "Confirm the exact &ldquo;Paid for by&rdquo; treatment and any state "
    "requirements with a campaign-finance attorney or your filing agency before "
    "airing or publishing."
)


def _esc(s: str) -> str:
    """Escape body text for ReportLab's XML paragraph parser."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _plural(n: int, singular: str, plural: str = None) -> str:
    return f"{n} {singular if n == 1 else (plural or singular + 's')}"


# ------------------------------------------------------- per-tier compliance
def _delivery_blocks(tier):
    note = tier.note
    if tier.family == "broadcast":
        if tier.medium == "radio":
            return [
                ("p", "<b>Candidate approval (record in studio):</b> "
                      "&ldquo;I&rsquo;m Matt Grant, candidate for U.S. Congress, "
                      "and I approve this message.&rdquo;"),
                ("p", "<b>Announcer close:</b> &ldquo;Paid for by the Matt Grant "
                      "for Congress Committee.&rdquo;"),
                ("p", _esc(note)),
            ]
        return [  # video
            ("p", "<b>Candidate approval (on camera):</b> &ldquo;I&rsquo;m Matt "
                  "Grant, and I approve this message.&rdquo;"),
            ("p", "<b>On-screen lower third (&ge; 4 seconds):</b> Paid for by "
                  "the Matt Grant for Congress Committee."),
            ("p", _esc(note)),
        ]
    if tier.family == "social":
        return [
            ("p", "The &ldquo;Paid for by&rdquo; disclaimer is built into the "
                  "copy above and counts toward the character limit."),
            ("p", _esc(note)),
        ]
    if tier.family == "voter-contact":
        if tier.medium == "text":
            return [
                ("p", "The abbreviated disclaimer is built into the opening "
                      "message above; follow-ups in an active thread need not "
                      "repeat it."),
                ("p", _esc(note)),
            ]
        return [
            ("p", "Live door and phone canvassing does not require an on-piece "
                  "FEC &ldquo;Paid for by&rdquo; disclaimer; the volunteer "
                  "identifies the campaign verbally."),
            ("p", _esc(note)),
        ]
    # speech
    return [
        ("p", "Live remarks do not require an FEC &ldquo;Paid for by&rdquo; "
              "disclaimer. Time yourself in practice and aim to land just under "
              "the slot."),
        ("p", _esc(note)),
    ]


# --------------------------------------------------------- content builders
def script_page(issue_key, tier_key, geo):
    issue = ISSUES[issue_key]
    tier = TIERS_BY_KEY[tier_key]
    body = localize(get_body(issue_key, tier_key), geo)
    stamp = size_stamp(body, tier)
    paras = [("p", _esc(p)) for p in body.split("\n\n")]
    return {
        "title": f"{issue['title']} — {tier.label} — {geo.name}",
        "eyebrow": issue["eyebrow"],
        "re": f"<b>{_esc(issue['title'])}</b>",
        "intro": [
            f"<b>{tier.label}</b> &nbsp;&middot;&nbsp; {FAMILY_LABEL[tier.family]}"
            f" &nbsp;&middot;&nbsp; <b>{_esc(geo.name)}</b>",
            f"<i>{stamp}</i>",
        ],
        "sections": [
            {"label": "Script", "blocks": paras},
            {"label": DELIVERY_LABEL[tier.family], "blocks": _delivery_blocks(tier)},
        ],
    }


def cover_page(issues, geos, tiers):
    tier_items = [f"<b>{t.label}</b> — {_tier_budget_phrase(t)}" for t in tiers]
    return {
        "title": "Matt Grant for Congress — Script Book",
        "eyebrow": "Campaign Script Book · Issue × Geography × Size",
        "re": "<b>Ready-to-record scripts, sized for every channel and audience</b>",
        "intro": [
            "This book pairs each of Matt&rsquo;s four priorities with the "
            "communities of Missouri&rsquo;s 2nd District and renders them at "
            "every script size &mdash; from a :15 video tag to a five-minute "
            "stump block. Every script is measured against its run-time, word, "
            "or character budget, and every page carries the committee "
            "disclaimer.",
            f"This run contains <b>{len(issues) * len(geos) * len(tiers)}</b> "
            f"scripts: {_plural(len(issues), 'issue')} &times; "
            f"{_plural(len(geos), 'geography', 'geographies')} &times; "
            f"{_plural(len(tiers), 'size tier')}.",
        ],
        "sections": [
            {"label": "Issues", "blocks": [
                ("ul", [f"<b>{ISSUES[i]['title']}</b> — {_esc(ISSUES[i]['core_message'])}"
                        for i in issues])]},
            {"label": "Geographies", "blocks": [
                ("ul", [f"<b>{GEOS_BY_KEY[g].name}</b> ({GEOS_BY_KEY[g].level})"
                        for g in geos])]},
            {"label": "Size Tiers", "blocks": [("ul", tier_items)]},
            {"label": "How to Regenerate or Scope", "blocks": [
                ("p", "Generated by <i>tools/script-generator/script_book.py</i>. "
                      "Scope a smaller book with <i>--issue</i>, <i>--geo</i>, "
                      "<i>--format</i>, or <i>--tier</i>; see the module README. "
                      "Sizing rules live in <i>sizing.py</i>; script copy in "
                      "<i>script_content.py</i>; geographies in <i>geo.py</i>."),
                ("p", EDU_DISCLAIMER),
            ]},
        ],
    }


def _tier_budget_phrase(t):
    if t.metric == "chars":
        return f"&le; {t.target} characters"
    if t.metric == "words":
        return f"~{t.target} words"
    return f":{t.target:d}s ({FAMILY_LABEL[t.family].lower()})"


# ---------------------------------------------------------------- QA report
def qa_report(issues, geos, tiers):
    print("\nLENGTH QA — every script measured against its budget:\n")
    counts = {"ok": 0, "over": 0, "under": 0}
    worst = []
    for ik in issues:
        for tk in [t.key for t in tiers]:
            tier = TIERS_BY_KEY[tk]
            # Length is geo-independent in word terms; report on the district copy.
            body = localize(get_body(ik, tk), GEOS_BY_KEY[geos[0]])
            r = check_length(body, tier)
            counts[r["status"]] += 1
            if r["status"] != "ok":
                worst.append(f"  · {ik}/{tk}: {size_stamp(body, tier)}")
    total = sum(counts.values())
    print(f"  scripts checked (per geography): {total}")
    print(f"  on size: {counts['ok']}   runs long: {counts['over']}   "
          f"runs short: {counts['under']}")
    if worst:
        print("\n  off-size scripts:")
        print("\n".join(worst))
    print()


# --------------------------------------------------------------------- main
def _split(values):
    out = []
    for v in values or []:
        out.extend(p.strip() for p in v.split(",") if p.strip())
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="Generate Matt Grant's PDF Script Book.")
    ap.add_argument("--out", default="scriptbook.pdf", help="output PDF path")
    ap.add_argument("--issue", action="append", help="issue key(s)")
    ap.add_argument("--geo", action="append", help="geography key(s)")
    ap.add_argument("--format", action="append", help="family: " + ", ".join(FAMILIES))
    ap.add_argument("--tier", action="append", help="size-tier key(s)")
    ap.add_argument("--list", action="store_true", help="list all keys and exit")
    args = ap.parse_args(argv)

    if args.list:
        print("ISSUES:  ", ", ".join(ISSUES))
        print("GEOS:    ", ", ".join(g.key for g in GEOS))
        print("FORMATS: ", ", ".join(FAMILIES))
        print("TIERS:   ", ", ".join(t.key for t in TIERS))
        return 0

    issues = _split(args.issue) or list(ISSUES)
    geos = _split(args.geo) or [g.key for g in GEOS]
    families = set(_split(args.format) or FAMILIES)
    tier_keys = _split(args.tier)

    tiers = [t for t in TIERS
             if (not tier_keys or t.key in tier_keys) and t.family in families]

    # Validate scopes early with a clear message.
    for label, picked, valid in (("issue", issues, ISSUES),
                                 ("geo", geos, GEOS_BY_KEY),
                                 ("tier", tier_keys, TIERS_BY_KEY)):
        bad = [p for p in picked if p not in valid]
        if bad:
            ap.error(f"unknown {label}(s): {', '.join(bad)}")
    if not tiers:
        ap.error("no size tiers selected (check --format / --tier)")

    contents = [cover_page(issues, geos, [t for t in tiers])]
    for ik in issues:
        for gk in geos:
            geo = GEOS_BY_KEY[gk]
            for tier in tiers:
                contents.append(script_page(ik, tier.key, geo))

    bl.build_many(args.out, contents,
                  title="Matt Grant for Congress — Script Book")
    print(f"wrote {args.out}  ({len(contents) - 1} scripts + cover, "
          f"{len(contents)} pages min)")
    qa_report(issues, geos, tiers)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
