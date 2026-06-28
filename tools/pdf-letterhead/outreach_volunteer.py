#!/usr/bin/env python3
"""
Volunteer / supporter recruitment letter — a ready-to-send outreach piece on
the branded letterhead, with the "Take Action" QR band switched on.

Content is values- and action-based and stays faithful to the documented
campaign facts and the four stated priorities in candidate/platform.md. It does
not add policy positions, claims, numbers, or endorsements.
"""
from brand_letter import build, PHONE, EMAIL, QR_ACTIONS, WINRED_DONATE

# Band: Vote, Get Involved, and a direct WinRed give (WinRed in place of the
# /donate page for this donor/volunteer-facing piece).
VOTE, ACT, _DONATE = QR_ACTIONS
BAND = [
    ("Vote",         VOTE[1], "Make your plan to vote"),
    ("Get Involved", ACT[1],  "Volunteer or sign up"),
    ("Give Now",     WINRED_DONATE[1], "Donate via WinRed"),
]

CONTENT = {
    "title": "Matt Grant for Congress — Volunteer Outreach",
    "date": "June 24, 2026",
    "recipient": (
        "To Our Neighbors<br/>"
        "Missouri’s 2nd Congressional District"
    ),
    "eyebrow": "Join the Campaign",
    "re": (
        "<b>RE:</b>&nbsp; Help put Missouri’s children first — before the "
        "August 4, 2026 primary"
    ),
    "intro": [
        "Friend,",
        "Matt Grant is a neighbor, a dad, and a problem-solver. He has spent more "
        "than two decades as a litigator, and he is running for Congress to put "
        "Missouri’s children first. Matt does not just talk — he takes action.",
        "This campaign is built by neighbors. Below is what Matt is fighting for, "
        "and three simple ways you can help today.",
    ],
    "sections": [
        {
            "label": "What Matt Is Fighting For",
            "blocks": [
                ("ol", [
                    "<b>Eliminate corruption in the family court system</b> — the "
                    "cause at the center of his candidacy.",
                    "<b>Term limits</b> for the U.S. House and Senate.",
                    "<b>A smaller federal government.</b>",
                    "<b>Lower taxes.</b>",
                ]),
                ("p", "These priorities reflect one belief: accountable, leaner "
                      "public service that protects families and children."),
            ],
        },
        {
            "label": "Three Ways to Help",
            "blocks": [
                ("ul", [
                    "<b>Vote</b> — confirm your registration and make your plan "
                    "for August 4.",
                    "<b>Get involved</b> — knock doors, make calls, host "
                    "neighbors, or put up a yard sign.",
                    "<b>Give</b> — a grassroots campaign runs on small-dollar "
                    "support from neighbors like you.",
                ]),
                ("p", "Each takes a minute — just scan the matching code below to "
                      "go straight there."),
            ],
        },
    ],
    "closing": [
        f"Questions, or want to volunteer directly? Reach the campaign anytime "
        f"at {PHONE} or {EMAIL}. Thank you for standing with us.",
    ],
    "signoff": "With gratitude,",
    "sign_name": "Matt Grant",
    "sign_meta": [
        "<b>Matt Grant</b>",
        "Candidate, U.S. Representative — Missouri 2nd Congressional District",
        "Matt Grant for Congress",
    ],
    # QR band on, with the three-way action set defined above.
    "action_band": True,
    "qr_actions": BAND,
    "qr_eyebrow": "Take Action",
    "qr_intro": "Scan to make your plan to vote, get involved, or give.",
}

if __name__ == "__main__":
    build("Matt-Grant-Volunteer-Outreach-Letter.pdf", CONTENT)
    print("wrote Matt-Grant-Volunteer-Outreach-Letter.pdf")
