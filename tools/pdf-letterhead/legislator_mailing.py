#!/usr/bin/env python3
"""
Personalized legislator mailing → ONE printable PDF.

Reads candidate/letters/senate-targets.csv (curated high-alignment Missouri
senators, sourced from the dougdevitre/mo-gov dataset), customizes a letter for
each recipient by title, committee/jurisdiction (their professional interests),
and alignment with Matt Grant's documented priorities, then compiles every
[personalized letter + CHILD Protection Act brief] packet into a single PDF via
brand_letter.build_many().

Faithful to candidate/profile.md and candidate/platform.md: it uses only
documented positions and verifiable recipient attributes (role, committee,
district, geography). It does NOT invent personal interests, poll numbers, or
data — the "data-driven strategy" language is framed as an offer to explore,
not as a claim about specific figures.

Usage:
    cd tools/pdf-letterhead
    python3 legislator_mailing.py                  # -> ../../candidate/letters/output/Matt-Grant-Legislator-Mailing.pdf
    python3 legislator_mailing.py out.pdf
"""
import csv
import os
import sys

from brand_letter import build_many, EMAIL, PHONE

DATE = "June 24, 2026"
HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.normpath(os.path.join(HERE, "..", "..", "candidate", "letters", "senate-targets.csv"))
DEFAULT_OUT = os.path.normpath(os.path.join(HERE, "..", "..", "candidate", "letters", "output", "Matt-Grant-Legislator-Mailing.pdf"))

SIGN_META = [
    "<b>Matt Grant</b>",
    "Candidate, U.S. Representative — Missouri 2nd Congressional District",
    "Matt Grant for Congress Committee",
]

# Primary committee name per segment (for the "Where We Align" paragraph/title).
SEG_COMMITTEE = {
    "JUDICIARY": "Senate Judiciary and Civil and Criminal Jurisprudence Committee",
    "FAMILIES": "Senate Families, Seniors and Health Committee",
}

ROLE_PHRASE = {"Chair": "Chair of", "Vice-Chair": "Vice-Chair of", "Member": "a member of"}


def role_phrase(role):
    return ROLE_PHRASE.get(role, "a member of")


def align_blocks(r):
    """The personalized 'Where We Align' paragraph(s), keyed off the recipient's
    committee/role/leadership/geography — their verifiable professional interests."""
    seg = r["alignment_segment"]
    blocks = []
    if seg in ("JUDICIARY", "FAMILIES"):
        committee = SEG_COMMITTEE[seg]
        rp = role_phrase(r["committee_role"])
        if seg == "JUDICIARY":
            blocks.append(("p",
                f"As {rp} the {committee}, you sit where Missouri's custody and "
                f"family-court questions land. That is exactly why I am writing. "
                f"Eliminating corruption in the family courts — so they protect "
                f"children instead of insiders — is the cause at the center of my "
                f"candidacy."))
        else:
            blocks.append(("p",
                f"As {rp} the {committee}, you carry Missouri's work on the "
                f"well-being of its children and families. Your mission and mine "
                f"meet on the same ground: a family-court system that is open, "
                f"accountable, and built to protect kids first."))
    elif seg == "LEADERSHIP":
        blocks.append(("p",
            f"As {r['leadership_role']}, you help decide which priorities move "
            f"and which stall. Restoring public trust begins with the questions "
            f"leaders choose to take up — and few matter more to Missouri "
            f"families than clean, accountable family courts."))
    else:  # GEOGRAPHY
        geo = r["geography"] or "the St. Louis region"
        blocks.append(("p",
            f"You represent {geo}, where families in and around Missouri's 2nd "
            f"District navigate the court system every day. We share those "
            f"constituents, and we share a stake in courts that are open, "
            f"accountable, and worthy of their trust."))
    # Secondary fiscal note for Appropriations members (faithful, no figures).
    if "Appropriations" in r["committees"]:
        blocks.append(("p",
            "Your seat on the Appropriations Committee also speaks to two more of "
            "my priorities: a leaner, more accountable government and lower taxes "
            "achieved by cutting waste — not by asking families to pay more."))
    return blocks


ASK = {
    "A": ("p",
          "I would be honored to have your endorsement of this reform on the "
          "record. If a conversation should come first, I would welcome a short "
          "meeting with you or your staff — and, at any level, your voice as an "
          "ally who helps amplify this to Missouri families."),
    "B": ("p",
          "I would welcome your support in whatever form fits: your endorsement "
          "of this reform on the record, a short conversation with you or your "
          "staff, or your willingness to stand as an issue ally and help amplify "
          "it to Missouri families."),
    "C": ("p",
          "I would value the chance to introduce myself and find common ground: "
          "a short conversation with you or your staff, or simply your "
          "willingness to be an issue ally and help amplify this work to the "
          "families we both serve."),
}


def letter_content(r):
    full = f"{r['first_name']} {r['last_name']}"
    recipient = (
        f"The Honorable {full}<br/>"
        f"Missouri State Senate<br/>"
        f"201 W. Capitol Ave., Rm. {r['room']}<br/>"
        f"Jefferson City, MO 65101"
    )
    intro = [
        f"Dear {r['salutation']} {r['last_name']}:",
        "I am Matt Grant — a neighbor, a dad, and a problem-solver running for "
        "the U.S. House in Missouri's 2nd District. After more than two decades "
        "in the courtroom, I am running on a promise to restore public trust, "
        "starting with one fight too few are having: cleaning up our family "
        "courts so they protect children instead of insiders.",
    ]
    sections = [
        {"label": "Where We Align", "blocks": align_blocks(r)},
        {"label": "The CHILD Protection Act of 2027", "blocks": [
            ("p",
             "I am championing the CHILD Protection Act — <b>Corruption Hiding "
             "Inside Legal Dockets</b>. It would tie federal Title IV-D grant "
             "money to states that keep their family courts clean, open, and "
             "accountable to the children they serve: clean courts keep the "
             "federal check; corrupt ones do not. It is federal leverage in "
             "service of a problem Missouri families feel at the state and local "
             "level every day."),
        ]},
        {"label": "Explore the Data Together", "blocks": [
            ("p",
             "I am building this campaign on evidence, not slogans. I would "
             "welcome the chance to explore data-informed approaches with you and "
             "your staff — to follow the facts on how our courts are serving "
             "children and to ground reform in evidence rather than rhetoric."),
        ]},
        {"label": "An Invitation to Restore Public Trust", "blocks": [
            ASK[r["ask_tier"]],
            ("p",
             "However you choose to engage, I hope you will join the effort to "
             "restore public trust in the institutions Missouri families rely on."),
        ]},
    ]
    closing = [
        f"Thank you for your service to the families of District {r['district']} "
        f"and to Missouri. I have enclosed a one-page brief on the CHILD "
        f"Protection Act, and I am available at your convenience — reach me at "
        f"{PHONE} or {EMAIL}.",
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
        # A single, dignified "Learn More" QR — appropriate for official
        # correspondence (no Donate ask to a sitting legislator).
        "action_band": True,
        "qr_actions": [(
            "Learn More",
            "https://mattgrantforcongress.org/issues",
            "Matt's priorities & the CHILD Protection Act",
        )],
        "qr_eyebrow": "Learn More",
        "qr_intro": "Scan to read Matt's priorities and the CHILD Protection Act.",
    }


def brief_content():
    """The CHILD Protection Act one-pager — faithful to
    candidate/letters/child-protection-act-brief.md. No recipient or signature."""
    return {
        "title": "The CHILD Protection Act of 2027 — Brief",
        "eyebrow": "Enclosure · The CHILD Protection Act of 2027",
        "re": "<b>Corruption Hiding Inside Legal Dockets</b> &mdash; Matt Grant for Congress, Missouri District 2",
        "intro": [
            "<b>The problem.</b> Too many children are caught in a family-court "
            "system that can protect insiders instead of kids. When dockets stay "
            "closed and courts are not held accountable, families pay the price — "
            "and children lose. Eliminating corruption in the family courts is "
            "the cause at the center of Matt Grant's candidacy.",
        ],
        "sections": [
            {"label": "The Solution", "blocks": [
                ("p",
                 "Matt proposes the CHILD Protection Act of 2027 — <i>Corruption "
                 "Hiding Inside Legal Dockets</i>. It calls for federal oversight "
                 "that ties Title IV-D federal grant money to state family-court "
                 "compliance, using the federal grant program as the lever for "
                 "accountability in state family courts. Clean, accountable "
                 "courts keep the federal check; corrupt ones do not."),
            ]},
            {"label": "Why Matt", "blocks": [
                ("p",
                 "A neighbor, a dad, and a problem-solver with 23 years in the "
                 "courtroom. He has already taken this fight to federal court (a "
                 "matter of public record). Matt does not just talk — he takes "
                 "action, and he is running for Congress to put Missouri's "
                 "children first."),
            ]},
            {"label": "The Ask", "blocks": [
                ("p",
                 "Endorse the reform, stand as an issue ally, or help amplify it "
                 "to Missouri families."),
            ]},
        ],
        "closing": [
            f"Reach the campaign: {EMAIL} · {PHONE} · mattgrantforcongress.org",
            "<b>Primary · August 4, 2026.</b>",
        ],
    }


def load_recipients(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    order = {"A": 0, "B": 1, "C": 2}
    rows.sort(key=lambda r: (order.get(r["ask_tier"], 9), int(r["district"])))
    return rows


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    os.makedirs(os.path.dirname(out), exist_ok=True)
    recipients = load_recipients(CSV_PATH)
    contents = []
    for r in recipients:
        contents.append(letter_content(r))
        contents.append(brief_content())
    build_many(out, contents, title="Matt Grant for Congress — Senate Mailing")
    print(f"wrote {out}  ({len(recipients)} recipients, {len(contents)} pages-of-content)")


if __name__ == "__main__":
    main()
