#!/usr/bin/env python3
"""
Donor value ladder letter — a ready-to-send, on-letterhead one-pager that
outlines the supporter levels ($25 -> $7,000) for a donor prospect, with the
"Give Now" QR band switched on.

Content mirrors candidate/donor-value-ladder.md (and web/lib/donorLadder.ts)
exactly — edit them together. Compliance framing per that doc's SS3 (verified
2026-07-10): levels are the committee's guaranteed thank-yous, never a
purchase; the FULL contribution counts against FEC limits ($3,500/election
for 2025-2026; $7,000 = primary + general); solicitation carries the
not-tax-deductible and best-efforts lines, and the letterhead footer carries
"Paid for by Matt Grant for Congress."
"""
from brand_letter import build, WINRED_DONATE, QR_ACTIONS

_VOTE, _ACT, DONATE_PAGE = QR_ACTIONS
# Source codes: WinRed reports attribute gifts from this letter's QR to
# `letter-supporter-levels` (see candidate/donor-value-ladder.md SS5 map).
BAND = [
    ("Give Now", WINRED_DONATE[1] + "?sc=letter-supporter-levels", "Donate via WinRed"),
    ("Supporter Levels", DONATE_PAGE[1], "See every level online"),
]

# One row per rung — same names/unlocks as web/lib/donorLadder.ts LADDER.
LADDER_ROWS = [
    ("$25", "<b>Front Porch Friend</b>", "Sticker pack + printable window sign"),
    ("$50", "<b>Yard Sign Crew</b>", "Official yard sign, delivered by your area captain"),
    ("$100", "<b>Grant Team Tee</b>", "Campaign T-shirt"),
    ("$250", "<b>Precinct Partner</b>", "Full schwag kit (tee, hat, stickers, sign) + the insider field-briefing email"),
    ("$500", "<b>Captain&rsquo;s Circle</b>", "Invitation to a supporter reception with Matt"),
    ("$1,000", "<b>MO-02 Founders Club</b>", "Founding-supporter listing (with your permission) + small-group coffee with Matt"),
    ("$3,500", "<b>Primary Champion</b><br/><i>per-election max</i>", "Seat at a private roundtable dinner with Matt + framed, signed MO-02 map"),
    ("$7,000", "<b>Full-Cycle Champion</b><br/><i>$3,500 primary + $3,500 general</i>", "Election-night host-committee listing + a second roundtable seat"),
]

CONTENT = {
    "title": "Matt Grant for Congress — Supporter Levels",
    "date": "July 10, 2026",
    "recipient": (
        "[Recipient name]<br/>"
        "[Street address]<br/>"
        "[City, State ZIP]"
    ),
    "eyebrow": "Supporter Levels · Donor Recognition",
    "re": (
        "<b>RE:</b>&nbsp; Every level of support unlocks a thank-you &mdash; "
        "before the August 4, 2026 primary"
    ),
    "intro": [
        "Friend,",
        "Matt Grant is a neighbor, a dad, and a problem-solver, and this campaign "
        "is built by neighbors like you. Every contribution pays for doors knocked, "
        "calls made, and voters reached across Missouri&rsquo;s 2nd District before "
        "the August 4, 2026 primary.",
        "As a thank-you, Matt Grant for Congress provides every supporter level with "
        "the items and invitations below. Levels <b>stack</b> with everything you have "
        "given this election cycle &mdash; a $50 supporter who gives $50 more becomes a "
        "$100-level supporter.",
    ],
    "sections": [
        {
            "label": "Supporter Levels",
            "blocks": [
                ("table",
                 ["Gift (cycle total)", "Level", "The committee's thank-you (stacks with all lower levels)"],
                 LADDER_ROWS,
                 [0.16, 0.28, 0.56]),
            ],
        },
        {
            "label": "The Fine Print",
            "blocks": [
                ("p",
                 "Your full contribution counts toward the federal limit of <b>$3,500 per "
                 "election</b> for 2025&ndash;2026; the primary and general are separate "
                 "elections, so $7,000 is the maximum for the cycle, with $3,500 designated "
                 "to the general election. Contributions to Matt Grant for Congress are "
                 "<b>not tax-deductible</b>. Federal law requires us to use best efforts to "
                 "collect and report the name, mailing address, occupation, and employer of "
                 "individuals whose contributions exceed $200 in an election cycle. "
                 "Contributions from corporations, labor unions, federal contractors, and "
                 "foreign nationals are prohibited."),
            ],
        },
    ],
    "closing": [
        "Give securely online at <b>mattgrantforcongress.org/donate</b>, scan the code "
        "below, or return a check payable to <b>Matt Grant for Congress</b> to "
        "1625 Mason Knoll Rd, St. Louis, MO 63131. Thank you for standing with us.",
    ],
    "signoff": "With gratitude,",
    "sign_name": "Matt Grant",
    "sign_meta": [
        "Candidate for U.S. House, Missouri's 2nd District",
        "Matt Grant for Congress",
    ],
    "action_band": True,
    "qr_actions": BAND,
    "qr_eyebrow": "Give Today",
    "qr_intro": "Scan to give at your level, or to see every supporter level online.",
}

if __name__ == "__main__":
    build("Matt-Grant-Supporter-Levels-Letter.pdf", CONTENT)
    print("wrote Matt-Grant-Supporter-Levels-Letter.pdf")
