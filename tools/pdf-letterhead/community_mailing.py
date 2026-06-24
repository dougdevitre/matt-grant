#!/usr/bin/env python3
"""
Personalized community-leader mailing → ONE PDF per group.

Reads candidate/letters/community-targets*.csv (influential MO-02 community
leaders, grouped by `segment`), customizes a letter for each recipient by their
title/organization/area and their segment's alignment with Matt Grant's
documented priorities, then emits ONE print-ready PDF per group (FAITH,
BUSINESS, EDUCATION, CIVIC) — each letter followed by a segment-tailored issue
one-pager — via brand_letter.build_many().

Faithful to candidate/profile.md and candidate/platform.md: only documented
positions, only verifiable recipient attributes. No invented people, positions,
numbers, or data. Replace the sample CSV with the campaign's real list (same
columns) and re-run.

Usage:
    cd tools/pdf-letterhead
    python3 community_mailing.py                       # uses community-targets.sample.csv
    python3 community_mailing.py ../../path/to/real.csv
"""
import csv
import os
import sys
from collections import defaultdict

from brand_letter import build_many, EMAIL, PHONE

DATE = "June 24, 2026"
HERE = os.path.dirname(os.path.abspath(__file__))
LETTERS = os.path.normpath(os.path.join(HERE, "..", "..", "candidate", "letters"))
DEFAULT_CSV = os.path.join(LETTERS, "community-targets.sample.csv")
OUTPUT_DIR = os.path.join(LETTERS, "output")

SIGN_META = [
    "<b>Matt Grant</b>",
    "Candidate, U.S. Representative — Missouri 2nd Congressional District",
    "Matt Grant for Congress Committee",
]

# Per-segment display name + output-file slug.
SEGMENTS = {
    "FAITH":     ("Faith & Community Leaders", "Faith-Community"),
    "BUSINESS":  ("Business & Chamber Leaders", "Business-Chamber"),
    "EDUCATION": ("Education Leaders", "Education"),
    "CIVIC":     ("Local Elected & Civic Leaders", "Local-Civic"),
}

# Community-adapted ask language (mirrors legislator_mailing.ASK).
ASK = {
    "A": ("p",
          "I would be honored to have your public endorsement. If a conversation "
          "should come first, I would welcome the chance to meet with you — and, "
          "at any level, your voice as an ally who helps carry this message to "
          "the people you serve."),
    "B": ("p",
          "I would welcome your support in whatever form fits: your endorsement, "
          "a short conversation, or your willingness to stand as an ally and help "
          "carry this message to those you serve."),
    "C": ("p",
          "I would value the chance to introduce myself and find common ground — "
          "a brief conversation, or simply your willingness to help amplify this "
          "work to the community you serve."),
}


def _org_phrase(r):
    return f" at {r['organization']}" if r.get("organization") else ""


def align_section(r):
    """Segment-specific 'Where We Align' section (label + blocks)."""
    seg = r["segment"]
    org = _org_phrase(r)
    role = r.get("title") or "a leader in your community"
    if seg == "FAITH":
        return {"label": "Where Our Values Meet", "blocks": [
            ("p",
             f"As {role}{org}, you carry a trusted voice for the families in our "
             f"community. We share a conviction: Missouri's children come first. "
             f"Eliminating corruption in the family courts — so they protect "
             f"children instead of insiders — is the cause at the center of my "
             f"candidacy, and I believe people of faith and conscience should "
             f"help lead it.")]}
    if seg == "BUSINESS":
        return {"label": "Where We Align on Opportunity", "blocks": [
            ("p",
             f"As {role}{org}, you know that trust and accountability are the "
             f"foundation of a healthy economy. I am running to restore both: a "
             f"leaner, more accountable federal government and lower taxes "
             f"achieved by cutting fraud and waste — not by asking families and "
             f"employers to pay more."),
            ("p",
             "It is the same standard I bring to my signature cause — cleaning up "
             "our family courts so they serve children, not insiders.")]}
    if seg == "EDUCATION":
        return {"label": "Putting Children First", "blocks": [
            ("p",
             f"As {role}{org}, your work touches every family with school-age "
             f"children. That is our common ground. I am running to put Missouri's "
             f"children first — starting with family courts that are open, "
             f"accountable, and built to protect kids.")]}
    # CIVIC
    return {"label": "Serving the Same Neighbors", "blocks": [
        ("p",
         f"As {role}{org}, you serve the same neighbors I hope to represent. "
         f"Restoring public trust is the heart of this campaign — through "
         f"accountable government, term limits that end careerism, and family "
         f"courts that finally protect children instead of insiders.")]}


# Enclosure topic + closing phrase per segment.
ENCLOSURE_TOPIC = {
    "FAITH": "the CHILD Protection Act",
    "EDUCATION": "the CHILD Protection Act",
    "CIVIC": "restoring public trust",
    "BUSINESS": "my plan for a leaner government and lower taxes",
}


def letter_content(r):
    seg = r["segment"]
    addr = [f"{r['honorific']} {r['first_name']} {r['last_name']}".strip()]
    if r.get("title"):
        addr.append(r["title"])
    if r.get("organization"):
        addr.append(r["organization"])
    addr.append(r["address_line_1"])
    if r.get("address_line_2"):
        addr.append(r["address_line_2"])
    addr.append(f"{r['city']}, {r['state']} {r['zip']}")
    recipient = "<br/>".join(addr)

    intro = [
        f"Dear {r['salutation']} {r['last_name']}:",
        "I am Matt Grant — a neighbor, a dad, and a problem-solver running for "
        "the U.S. House in Missouri's 2nd District. After more than two decades "
        "in the courtroom, I am running on a promise to restore public trust, "
        "starting with one fight too few are having: cleaning up our family "
        "courts so they protect children instead of insiders.",
    ]
    sections = [
        align_section(r),
        {"label": "The CHILD Protection Act of 2027", "blocks": [
            ("p",
             "I am championing the CHILD Protection Act — <b>Corruption Hiding "
             "Inside Legal Dockets</b>. It would tie federal Title IV-D grant "
             "money to states that keep their family courts clean, open, and "
             "accountable to the children they serve: clean courts keep the "
             "federal check; corrupt ones do not.")]},
        {"label": "Explore the Data Together", "blocks": [
            ("p",
             "I am building this campaign on evidence, not slogans. I would "
             "welcome the chance to explore data-informed approaches with you — "
             "to follow the facts on how our institutions are serving families "
             "and to ground reform in evidence rather than rhetoric.")]},
        {"label": "An Invitation to Restore Public Trust", "blocks": [
            ASK[r["ask_tier"]],
            ("p",
             "However you choose to engage, I hope you will join the effort to "
             "restore public trust in the institutions our families rely on.")]},
    ]
    area = f" in {r['area_focus']}" if r.get("area_focus") else ""
    closing = [
        f"Thank you for your leadership{area}. I have enclosed a short brief on "
        f"{ENCLOSURE_TOPIC[seg]}, and I am available at your convenience — reach "
        f"me at {PHONE} or {EMAIL}.",
    ]
    return {
        "title": f"Matt Grant — Letter to {r['salutation']} {r['last_name']}",
        "date": DATE,
        "recipient": recipient,
        "eyebrow": "An Invitation from Matt Grant",
        "re": ("<b>RE:</b>&nbsp; Joining the effort to restore public trust — and "
               "to put Missouri's children first"),
        "intro": intro,
        "sections": sections,
        "closing": closing,
        "signoff": "Respectfully,",
        "sign_name": "Matt Grant",
        "sign_meta": SIGN_META,
        "action_band": True,
        "qr_actions": [(
            "Learn More",
            "https://mattgrantforcongress.org/issues",
            "Matt's priorities & the CHILD Protection Act",
        )],
        "qr_eyebrow": "Learn More",
        "qr_intro": "Scan to read Matt's priorities and the CHILD Protection Act.",
    }


def _contact_close():
    return [
        f"Reach the campaign: {EMAIL} · {PHONE} · mattgrantforcongress.org",
        "<b>Primary · August 4, 2026.</b>",
    ]


def brief_content(seg):
    """Segment-tailored one-pager (no recipient/signature)."""
    if seg in ("FAITH", "EDUCATION"):
        return {
            "title": "The CHILD Protection Act of 2027 — Brief",
            "eyebrow": "Enclosure · The CHILD Protection Act of 2027",
            "re": "<b>Corruption Hiding Inside Legal Dockets</b> &mdash; Matt Grant for Congress, Missouri District 2",
            "intro": ["<b>The problem.</b> Too many children are caught in a "
                      "family-court system that can protect insiders instead of "
                      "kids. When dockets stay closed and courts are not held "
                      "accountable, families pay the price — and children lose."],
            "sections": [
                {"label": "The Solution", "blocks": [("p",
                    "Matt proposes the CHILD Protection Act of 2027 — <i>Corruption "
                    "Hiding Inside Legal Dockets</i> — tying Title IV-D federal "
                    "grant money to state family-court compliance. Clean, "
                    "accountable courts keep the federal check; corrupt ones do "
                    "not.")]},
                {"label": "Why Matt", "blocks": [("p",
                    "A neighbor, a dad, and a problem-solver with 23 years in the "
                    "courtroom. He has already taken this fight to federal court "
                    "(a matter of public record), and he is running to put "
                    "Missouri's children first.")]},
                {"label": "The Ask", "blocks": [("p",
                    "Endorse the reform, stand as an issue ally, or help amplify "
                    "it to Missouri families.")]},
            ],
            "closing": _contact_close(),
        }
    if seg == "BUSINESS":
        return {
            "title": "Leaner Government, Lower Taxes — Brief",
            "eyebrow": "Enclosure · Leaner Government, Lower Taxes",
            "re": "<b>Accountability that respects employers and families</b> &mdash; Matt Grant for Congress, Missouri District 2",
            "intro": ["<b>The principle.</b> A healthy economy rests on trust and "
                      "accountability. Matt would restore both — and fund tax "
                      "relief by cutting waste, not by asking families and "
                      "employers to pay more."],
            "sections": [
                {"label": "A Smaller, Accountable Government", "blocks": [("p",
                    "Matt calls for a leaner federal government, achieved through "
                    "measures such as a hiring freeze and early-retirement "
                    "packages for federal employees.")]},
                {"label": "Lower Taxes by Cutting Waste", "blocks": [("p",
                    "Matt supports lower taxes, achieved by reducing fraud, waste, "
                    "and the number of government employees — not by other means.")]},
                {"label": "The Through-Line", "blocks": [("p",
                    "The same standard drives his signature cause: cleaning up "
                    "Missouri's family courts so they serve children, not "
                    "insiders.")]},
            ],
            "closing": _contact_close(),
        }
    # CIVIC
    return {
        "title": "Restoring Public Trust — Brief",
        "eyebrow": "Enclosure · Restoring Public Trust",
        "re": "<b>Accountable government for the neighbors we both serve</b> &mdash; Matt Grant for Congress, Missouri District 2",
        "intro": ["<b>The promise.</b> Matt is running to restore public trust in "
                  "the institutions Missouri families rely on — and to take "
                  "action, not just talk."],
        "sections": [
            {"label": "Clean Up the Family Courts", "blocks": [("p",
                "Matt's top priority is eliminating corruption in the family "
                "court system, through the CHILD Protection Act of 2027.")]},
            {"label": "End Careerism", "blocks": [("p",
                "Matt supports term limits for both the U.S. House and Senate, "
                "applied with a grandfather clause.")]},
            {"label": "Accountable, Leaner Government", "blocks": [("p",
                "Matt calls for a smaller, more accountable federal government and "
                "lower taxes achieved by cutting fraud and waste.")]},
        ],
        "closing": _contact_close(),
    }


def load_recipients(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    grouped = defaultdict(list)
    for r in rows:
        grouped[r["segment"]].append(r)
    order = {"A": 0, "B": 1, "C": 2}
    for seg in grouped:
        grouped[seg].sort(key=lambda r: (order.get(r["ask_tier"], 9), r["last_name"]))
    return grouped


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    grouped = load_recipients(csv_path)
    written = []
    for seg, recipients in grouped.items():
        if seg not in SEGMENTS:
            print(f"  ! skipping unknown segment {seg!r} ({len(recipients)} rows)")
            continue
        name, slug = SEGMENTS[seg]
        contents = []
        for r in recipients:
            contents.append(letter_content(r))
            contents.append(brief_content(seg))
        out = os.path.join(OUTPUT_DIR, f"Matt-Grant-{slug}-Mailing.pdf")
        build_many(out, contents, title=f"Matt Grant for Congress — {name} Mailing")
        written.append((name, len(recipients), out))
        print(f"wrote {out}  ({len(recipients)} recipients)")
    print(f"\n{len(written)} group PDF(s) written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
