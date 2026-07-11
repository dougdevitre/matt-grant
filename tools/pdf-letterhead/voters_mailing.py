#!/usr/bin/env python3
"""
Voter mail merge → ONE PDF per targeting segment (voter-file-plan.md Phase 4).

Reads a mail-list CSV exported from Dashboard → Field → Voter database
(columns: Voter ID, Name, Mailing address, City, Zip, Segment, Age band; the
export's first line is the RSMo 115.157 notice and is skipped automatically),
then emits one print-ready PDF per segment — PERSUADE / MOBILIZE / BANK /
PROSPECT — with a one-page letter per voter via brand_letter.build_many().
MONITOR rows are skipped (not a mail universe; see workflows/voter-targeting.md).

Compliance: every page carries the verbatim "Paid for by Matt Grant for
Congress." footer (brand_letter). Content is faithful to candidate/platform.md —
documented positions only; no invented facts, numbers, or endorsements. The
INPUT list is RSMo 115.157-restricted data: political use only, handle per
candidate/voter-file-plan.md §2 and delete stale exports.

Election dates used (verified 2026-07-10 against candidate/absentee-voting-guide.md;
re-verify with your election authority before printing): primary Tuesday,
August 4, 2026; no-excuse in-person absentee ("early") voting July 21 - August 3
at sites designated by each county election authority.

Usage:
    cd tools/pdf-letterhead
    python3 voters_mailing.py ../../path/to/mail-list-<precinct>.csv
"""
import csv
import os
import sys
from collections import defaultdict
from datetime import date

from brand_letter import build_many, EMAIL, PHONE

HERE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(HERE, "output")
DATE = date.today().strftime("%B %-d, %Y") if os.name != "nt" else date.today().strftime("%B %d, %Y")

SIGN_META = [
    "<b>Matt Grant</b>",
    "Candidate, U.S. Representative — Missouri 2nd Congressional District",
    "Matt Grant for Congress",
]

VOTE_LINE = (
    "The Republican primary is <b>Tuesday, August 4, 2026</b>. No-excuse in-person "
    "absentee voting runs <b>July 21 – August 3</b> at sites designated by your county "
    "election authority — check their website for locations and hours."
)

PRIORITIES = (
    "Matt is running on four priorities: eliminating corruption in the family courts "
    "(his signature CHILD Protection Act of 2027 ties federal Title IV-D money to "
    "clean, accountable courts), term limits for Congress, a smaller and more "
    "accountable federal government, and lower taxes achieved by cutting fraud "
    "and waste — not by asking families to pay more."
)

# Per-segment display name, output slug, and letter body. Segment definitions:
# workflows/voter-targeting.md + candidate/voter-file-plan.md §4.
SEGMENTS = {
    "PERSUADE": ("Persuade (habitual voters, lean unknown)", "Persuade"),
    "MOBILIZE": ("Mobilize (supporters who need a turnout nudge)", "Mobilize"),
    "BANK": ("Bank (reliable supporters)", "Bank"),
    "PROSPECT": ("Prospect (newer / lower-history voters)", "Prospect"),
}


def letter_content(segment, first, last, address, city, zip5):
    recipient = "<br/>".join(
        [f"{first} {last}".strip(), address, f"{city}, MO {zip5}"]
    )
    common = {
        "date": DATE,
        "recipient": recipient,
        "signoff": "Respectfully,",
        "sign_name": "Matt Grant",
        "sign_meta": SIGN_META,
        "action_band": True,
    }
    name = first or "Neighbor"
    if segment == "MOBILIZE":
        return {
            **common,
            "title": f"Matt Grant — Letter to {first} {last}",
            "eyebrow": "Your Vote Decides This One",
            "re": "<b>RE:</b>&nbsp; The August 4 primary — and how to vote early",
            "intro": [
                f"Dear {name},",
                "Primaries are decided by the neighbors who show up. I'm Matt Grant — "
                "a neighbor, a dad, and a problem-solver running for the U.S. House in "
                "Missouri's 2nd District — and I'm writing to ask you to make a plan to vote.",
            ],
            "sections": [
                {"label": "Make Your Plan", "blocks": [("p", VOTE_LINE)]},
                {"label": "What I'm Fighting For", "blocks": [("p", PRIORITIES)]},
            ],
            "closing": [
                f"If you have questions, reach me at {PHONE} or {EMAIL}. I hope to earn your vote.",
            ],
            "qr_actions": [("How to Vote", "https://mattgrantforcongress.org/vote", "Dates, sites, and absentee options")],
            "qr_eyebrow": "Make a Plan",
            "qr_intro": "Scan for voting dates, early-vote sites, and absentee options.",
        }
    if segment == "BANK":
        return {
            **common,
            "title": f"Matt Grant — Letter to {first} {last}",
            "eyebrow": "Thank You — And One Ask",
            "re": "<b>RE:</b>&nbsp; Vote early, and bring a neighbor",
            "intro": [
                f"Dear {name},",
                "You're the kind of voter campaigns are built on — you show up. I'm Matt "
                "Grant, and I'd be honored to have your vote in the August 4 primary. My "
                "one ask: vote early if you can, and bring a neighbor with you.",
            ],
            "sections": [
                {"label": "Vote Early", "blocks": [("p", VOTE_LINE)]},
                {"label": "Why I'm Running", "blocks": [("p", PRIORITIES)]},
            ],
            "closing": [
                f"Thank you — and if you'd like a yard sign or a way to help, reach the campaign at {PHONE} or {EMAIL}.",
            ],
            "qr_actions": [("Get Involved", "https://mattgrantforcongress.org/join", "Yard signs, volunteering, updates")],
            "qr_eyebrow": "One More Thing",
            "qr_intro": "Scan for a yard sign or ways to help before August 4.",
        }
    if segment == "PROSPECT":
        return {
            **common,
            "title": f"Matt Grant — Letter to {first} {last}",
            "eyebrow": "An Introduction — And an Invitation",
            "re": "<b>RE:</b>&nbsp; A new voice for MO-02, and how to make yours count",
            "intro": [
                f"Dear {name},",
                "I'm Matt Grant — a neighbor, a dad, and a problem-solver with more than "
                "two decades in the courtroom, running for the U.S. House in Missouri's "
                "2nd District. Whether this is your first primary or your fiftieth, your "
                "vote counts the same — and this one is close to home.",
            ],
            "sections": [
                {"label": "What I Stand For", "blocks": [("p", PRIORITIES)]},
                {"label": "How to Vote", "blocks": [("p", VOTE_LINE)]},
            ],
            "closing": [
                f"I'd welcome your questions any time — {PHONE} or {EMAIL}.",
            ],
            "qr_actions": [("How to Vote", "https://mattgrantforcongress.org/vote", "Dates, sites, and absentee options")],
            "qr_eyebrow": "Make It Count",
            "qr_intro": "Scan for voting dates and locations.",
        }
    # PERSUADE (default): the persuasion piece.
    return {
        **common,
        "title": f"Matt Grant — Letter to {first} {last}",
        "eyebrow": "A Neighbor Asking for Your Vote",
        "re": "<b>RE:</b>&nbsp; Restoring public trust — starting with our family courts",
        "intro": [
            f"Dear {name},",
            "I'm Matt Grant — a neighbor, a dad, and a problem-solver running for the "
            "U.S. House in Missouri's 2nd District. After more than two decades in the "
            "courtroom, I'm running on a promise to restore public trust, starting with "
            "one fight too few are having: cleaning up our family courts so they protect "
            "children instead of insiders.",
        ],
        "sections": [
            {"label": "The CHILD Protection Act of 2027", "blocks": [
                ("p",
                 "The CHILD Protection Act — <b>Corruption Hiding Inside Legal "
                 "Dockets</b> — would tie federal Title IV-D grant money to states that "
                 "keep their family courts clean, open, and accountable: clean courts "
                 "keep the federal check; corrupt ones do not.")]},
            {"label": "The Rest of the Job", "blocks": [
                ("p",
                 "I also support term limits for the U.S. House and Senate, a leaner and "
                 "more accountable federal government, and lower taxes achieved by "
                 "cutting fraud and waste.")]},
            {"label": "August 4", "blocks": [("p", VOTE_LINE)]},
        ],
        "closing": [
            f"I'd be honored to earn your vote. Questions? Reach me at {PHONE} or {EMAIL}.",
        ],
        "qr_actions": [("Learn More", "https://mattgrantforcongress.org/issues", "Matt's priorities & the CHILD Protection Act")],
        "qr_eyebrow": "Learn More",
        "qr_intro": "Scan to read Matt's priorities and the CHILD Protection Act.",
    }


def parse_name(name):
    """Export names are 'Last, First' — return (first, last)."""
    if "," in name:
        last, _, first = name.partition(",")
        return first.strip(), last.strip()
    parts = name.strip().split()
    return (" ".join(parts[:-1]), parts[-1]) if len(parts) > 1 else (name.strip(), "")


def load_rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        lines = f.read().splitlines()
    # The export's first line is the RSMo notice banner — drop it before parsing.
    if lines and lines[0].startswith('"Missouri voter registration data'):
        lines = lines[1:]
    elif lines and lines[0].startswith("Missouri voter registration data"):
        lines = lines[1:]
    return list(csv.DictReader(lines))


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python3 voters_mailing.py <mail-list.csv>  (export from Dashboard → Voter database)")
    rows = load_rows(sys.argv[1])
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    grouped = defaultdict(list)
    skipped = 0
    for r in rows:
        seg = (r.get("Segment") or "").strip().upper()
        if seg in SEGMENTS:
            grouped[seg].append(r)
        else:
            skipped += 1
    if skipped:
        print(f"  skipped {skipped} row(s) outside the mail universes (MONITOR/unknown)")
    written = 0
    for seg, seg_rows in grouped.items():
        name, slug = SEGMENTS[seg]
        contents = []
        for r in sorted(seg_rows, key=lambda r: (r.get("Zip", ""), r.get("Name", ""))):
            first, last = parse_name(r.get("Name", ""))
            contents.append(
                letter_content(seg, first, last, r.get("Mailing address", ""), r.get("City", ""), r.get("Zip", ""))
            )
        out = os.path.join(OUTPUT_DIR, f"Matt-Grant-Voter-Mailing-{slug}.pdf")
        build_many(out, contents, title=f"Matt Grant for Congress — Voter Mailing ({name})")
        print(f"wrote {out}  ({len(seg_rows)} letters)")
        written += 1
    print(f"\n{written} segment PDF(s) written to {OUTPUT_DIR}")
    print("Handle the input CSV per RSMo 115.157 (political use only) — delete when stale.")


if __name__ == "__main__":
    main()
