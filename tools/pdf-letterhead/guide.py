#!/usr/bin/env python3
"""Matt Grant for Congress — branded GUIDE generator.

A sibling to brand_letter.py for multi-section one/two-page guides (volunteer
onboarding, captain protocol, etc.) rather than letters. Reuses the same
"Ledger & Banner" design system — vector masthead, red tracked eyebrows, hairline
rules, the optional scannable QR "Take Action" band, and the compliant
"Paid for by…" footer — so guides match the campaign's letters and email/OG look.

Content is data: a guide dict with a title, subtitle, intro, a list of eyebrowed
sections (each with body paragraphs and/or bullets), a DO / DON'T panel, and an
optional QR band. Run directly to render the bundled Team Captain + Volunteer
guides:

    python guide.py --out-dir ~/Downloads
"""
import argparse
import os

import brand_letter as bl
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether

INK, FIELD, BRICK, PANEL, LINE, SLATE, BODYINK = bl.INK, bl.FIELD, bl.BRICK, bl.PANEL, bl.LINE, bl.SLATE, bl.BODYINK
DISPLAY, DISPLAY_I, SANS, SANS_B = bl.DISPLAY, bl.DISPLAY_I, bl.SANS, bl.SANS_B
CW = bl.CONTENT_W


def styles():
    """Letter styles + a few guide-specific additions (title, subtitle, headings, panel)."""
    s = bl.styles()
    s["title"] = ParagraphStyle("title", fontName=DISPLAY, fontSize=25, leading=28, textColor=INK, spaceAfter=2)
    s["subtitle"] = ParagraphStyle("subtitle", fontName=DISPLAY_I, fontSize=12, leading=16, textColor=SLATE, spaceAfter=11)
    s["intro"] = ParagraphStyle("intro", fontName=SANS, fontSize=10.8, leading=15.8, textColor=BODYINK, spaceAfter=12)
    s["h2"] = ParagraphStyle("h2", fontName=DISPLAY, fontSize=13.5, leading=16.5, textColor=INK, spaceBefore=2, spaceAfter=4)
    s["pli"] = ParagraphStyle("pli", fontName=SANS, fontSize=9.9, leading=13.4, textColor=BODYINK, spaceAfter=3)
    s["dohead"] = ParagraphStyle("dohead", fontName=SANS_B, fontSize=10.5, leading=13, textColor=FIELD, spaceAfter=5)
    s["donthead"] = ParagraphStyle("donthead", fontName=SANS_B, fontSize=10.5, leading=13, textColor=BRICK, spaceAfter=5)
    return s


def dd_panel(do, dont, st):
    """A two-column DO / DON'T quick-reference panel on the warm panel fill."""
    def cell(head_style, head, items):
        return [Paragraph(head, head_style)] + [Paragraph(f"• {x}", st["pli"]) for x in items]
    t = Table([[cell(st["dohead"], "DO", do), cell(st["donthead"], "DON’T", dont)]],
              colWidths=[CW / 2 - 5, CW / 2 - 5])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("BOX", (0, 0), (-1, -1), 0.75, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.75, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
    ]))
    return t


def build_guide(out_path, g):
    """Render one guide dict to a print-ready, on-brand PDF."""
    st = styles()
    story = [Paragraph(g["title"], st["title"]), Paragraph(g["subtitle"], st["subtitle"]),
             bl.HRule(color=LINE, thickness=0.9, space_after=12),
             Paragraph(g["intro"], st["intro"])]
    for sec in g["sections"]:
        block = [bl.SectionLabel(sec["eyebrow"]), Paragraph(sec["heading"], st["h2"])]
        for para in sec.get("body", []):
            block.append(Paragraph(para, st["body"]))
        if sec.get("bullets"):
            block.append(bl.make_list(sec["bullets"], st, numbered=False))
        story.append(KeepTogether(block))
    if g.get("do") or g.get("dont"):
        story.append(Spacer(1, 6))
        story.append(KeepTogether([bl.SectionLabel("Quick reference"), Spacer(1, 6),
                                   dd_panel(g.get("do", []), g.get("dont", []), st)]))
    qr = g.get("qr")
    if qr:
        story.extend(bl.action_band(st, actions=qr["actions"], intro=qr["intro"],
                                    eyebrow=qr.get("eyebrow", "Take Action")))
    doc = bl._new_doc(out_path, g["title"])
    doc.build(story)
    print("wrote", out_path)


# --------------------------------------------------------------------- content
CAPTAIN = {
    "title": "Team Captain Guide",
    "subtitle": "MO-02 Volunteer Program — how to lead your team",
    "intro": "Welcome, Captain. You’re the backbone of the field program. This is the operating "
             "protocol for leading a team — keep it close.",
    "sections": [
        {"eyebrow": "Your role", "heading": "Lead a team of 5–10",
         "body": ["You recruit, welcome, schedule, and debrief your volunteers and own your Events. Once "
                  "your admin has set up the field-ops tables in Airtable, you also cut and assign Canvass "
                  "Turf and Contact Lists and keep their statuses current on the dashboard. You can read "
                  "everything in the system; you don’t edit the master Task Templates or the Start Here guide."]},
        {"eyebrow": "The rule", "heading": "Keep your team to 5–10 (split at 10)",
         "body": ["Span of control is the rule — a team small enough for real relationships. The "
                  "dashboard Volunteers board shows your live team count."],
         "bullets": ["At ~10, stop adding — promote a strong, Core-commitment volunteer to captain "
                     "and split your turf so both teams return to 5–10.",
                     "Quality of contact beats roster size."]},
        {"eyebrow": "Recruiting", "heading": "How volunteers join your team",
         "bullets": ["Auto-match — from /community → Join a team, a volunteer routes to the captain "
                     "whose area fits their ZIP, else the least-loaded captain.",
                     "Admin assignment — an admin assigns someone to you from their volunteer page.",
                     "You claim them — Volunteers board → a card → + Claim to my team; find your "
                     "people with the “My volunteers” filter.",
                     "Welcome each new join within 48 hours."]},
        {"eyebrow": "Coverage", "heading": "Your area",
         "body": ["Each captain has a coverage area (ZIP / city / county) set on the dashboard Team page. "
                  "It powers auto-match, so nearby volunteers route to you. Ask an admin to set or update "
                  "yours; areas with no captain are coverage gaps to fill."]},
        {"eyebrow": "Pipeline", "heading": "Becoming a captain",
         "body": ["A volunteer applies via /join (Team Captain) — flagged as a captain applicant on the "
                  "Volunteers board — or a committed (Core) volunteer is tapped. An admin clicks "
                  "Promote to Captain, granting dashboard access and emailing their role. Captains can’t "
                  "promote captains — admin-only by design."]},
        {"eyebrow": "Scaling (admins)", "heading": "Sizing the program",
         "body": ["Captains = the larger of (a) one per coverage area and (b) active volunteers ÷ 8 — "
                  "then split any captain over 10. As you pass ~8 captains, designate a senior captain to "
                  "mentor and coordinate a cluster of nearby teams (an organizing practice — no separate "
                  "role or login) so no one’s span gets too wide."]},
    ],
    "do": ["Keep your team to 5–10", "Welcome each join within 48 hours",
           "Own your events; cut & assign turf and lists once they’re set up",
           "Confirm volunteers and log results", "Tell an admin when you’re full"],
    "dont": ["Grow past ~10 without splitting", "Leave a new volunteer un-welcomed",
             "Edit the master Task Templates or Start Here"],
    "qr": {"eyebrow": "Lead the work",
           "intro": "Scan to open your dashboard or send people to get involved.",
           "actions": [
               ("Campaign HQ", "https://mattgrantforcongress.org/dashboard", "Open the dashboard"),
               ("Take Action", "https://mattgrantforcongress.org/act", "Ways to get involved"),
           ]},
}

VOLUNTEER = {
    "title": "Volunteer Guide",
    "subtitle": "MO-02 Volunteer Program — your place on the team",
    "intro": "Thanks for stepping up. Here’s how to plug in, find work that fits you, and make the most "
             "of your time — and how your captain supports you.",
    "sections": [
        {"eyebrow": "Your team", "heading": "You’re not on your own",
         "body": ["When you join, you’re matched to a team captain — your point person. They welcome "
                  "you, help you pick your first action, and staff you onto local work. Reach out to them "
                  "anytime."]},
        {"eyebrow": "Your next action", "heading": "Find work matched to you",
         "body": ["Sign in at mattgrantforcongress.org/community. Your hub shows “Your next actions” — "
                  "tasks matched to what you told us: your roles, skills, availability, and where you live."],
         "bullets": ["Pick one that fits, click “I’m interested,” and your captain gets you started.",
                     "Update what you care about anytime — the matches follow."]},
        {"eyebrow": "How you help", "heading": "Pick your level",
         "body": ["Help your way: from home (calls, texts, social, handwritten notes) or in person (doors, "
                  "events, yard signs). Give one hour or a weekly shift — every bit moves the race."]},
        {"eyebrow": "Do the work", "heading": "Your captain sets you up",
         "body": ["When your captain assigns you a task, you’ll get a private task link — no login needed — "
                  "with the script and talking points for that task."],
         "bullets": ["At the door or on the phone, be warm and brief.",
                     "Mark the task done on that link so your captain sees the result."]},
        {"eyebrow": "Stay connected", "heading": "Updates — on your terms",
         "body": ["We’ll reach you by email, and by text only if you opted in. You’re always in control: "
                  "reply STOP to texts, or use the unsubscribe link in any email — we honor it immediately."]},
        {"eyebrow": "Grow", "heading": "Bring a neighbor — or lead",
         "body": ["This race is won one neighbor at a time. Invite someone to join you — and if you want to "
                  "do more, ask your captain about becoming a team captain yourself."]},
    ],
    "do": ["Raise your hand on the actions matched to you on the community hub",
           "Do the work your captain assigns and mark the task done on your link",
           "Lean on your captain — that’s what they’re there for",
           "Be warm, brief, and respectful at every contact"],
    "dont": ["Contact anyone who has opted out", "Freelance someone else’s assignment",
             "Share voter or donor data outside the tools"],
    "qr": {"eyebrow": "Take Action",
           "intro": "Scan to find your next action, make your plan to vote, or chip in.",
           "actions": [
               ("Your hub", "https://mattgrantforcongress.org/community", "Find your next actions"),
               ("Vote", "https://mattgrantforcongress.org/vote", "Make your plan to vote"),
               ("Donate", "https://mattgrantforcongress.org/donate", "Chip in"),
           ]},
}

RAPID_RESPONSE = {
    "title": "Rapid-Response Guide",
    "subtitle": "MO-02 Campaign \u2014 how to react to an attack or crisis, same day",
    "intro": "Attacks arrive fast and at bad hours. Speed comes from preparation, not adrenaline. "
             "This is the procedure \u2014 verify, decide, respond (or don\u2019t), and write it down. "
             "Fill in your roles and pre-clear your answers before you need them.",
    "sections": [
        {"eyebrow": "The clock", "heading": "Know in 30, decide in an hour, respond in 2\u20134",
         "body": ["The pieces below exist so nobody invents process during the crisis. Move fast, "
                  "but never respond to something you haven\u2019t verified."]},
        {"eyebrow": "Roles", "heading": "Name owners now \u2014 for every level",
         "bullets": ["First alert / triage \u2014 sees it, runs verify + triage, wakes the right people.",
                     "Decision-maker \u2014 the respond/ignore call (campaign manager; candidate for the worst).",
                     "Drafter \u2014 writes it. Approver \u2014 second eyes before anything publishes.",
                     "Legal \u2014 anything with litigation exposure. Publisher \u2014 posts, nothing else.",
                     "One spokesperson. Two-person review before release. No staff posts without approval."]},
        {"eyebrow": "Step 1 \u2014 verify", "heading": "Prove it before you touch it",
         "bullets": ["Source: a real outlet/person, or an anonymous/new account?",
                     "Substance: pull the full record \u2014 the whole vote, quote, or clip.",
                     "Media: is any image/audio/video genuine? If it may be doctored, switch to the "
                     "deepfake runbook and capture evidence before it\u2019s deleted."]},
        {"eyebrow": "Step 2 \u2014 triage", "heading": "Not every attack earns a response",
         "body": ["Score reach, credibility, trajectory, persuadable-voter exposure, and how true it is "
                  "against you. Low total \u2014 ignore and log; responding amplifies it. High total \u2014 respond."],
         "bullets": ["Always correct a false claim about when/where/how to vote, immediately.",
                     "Anything with legal exposure goes to counsel before any public move."]},
        {"eyebrow": "Step 3 \u2014 respond", "heading": "Correct, then pivot",
         "bullets": ["Draft tight; correct the record, don\u2019t relitigate it; get back to the four priorities.",
                     "Two-person approval, always. Publish only the channels that match the attack.",
                     "Paid communications clear the pre-publish checklist and carry the disclaimer."]},
        {"eyebrow": "Step 4 \u2014 document", "heading": "One record per activation",
         "body": ["Log what happened, what you decided, and why (or why not). It ends re-litigation and "
                  "builds the playbook for next time. Then return to your own message."]},
    ],
    "do": ["Verify before you amplify", "Use the triage score, not adrenaline",
           "Correct the record, then pivot back to your message",
           "Two-person sign-off on anything public", "Pre-clear answers for your known vulnerabilities"],
    "dont": ["Respond to a hoax (it legitimizes it)", "Feed a dying story with a loud response",
             "Post from personal staff accounts or engage trolls",
             "Make legal claims without counsel"],
    "qr": {"eyebrow": "Be ready",
           "intro": "Scan to open your dashboard or send people to get involved.",
           "actions": [
               ("Campaign HQ", "https://mattgrantforcongress.org/dashboard", "Open the dashboard"),
               ("Take Action", "https://mattgrantforcongress.org/act", "Ways to get involved"),
           ]},
}


GUIDES = {"team-captain": CAPTAIN, "volunteer": VOLUNTEER, "rapid-response": RAPID_RESPONSE}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Render branded Matt Grant guides to PDF.")
    ap.add_argument("--out-dir", default=".", help="output directory (default: current dir)")
    ap.add_argument("--only", choices=sorted(GUIDES), help="render just one guide")
    args = ap.parse_args()
    out_dir = os.path.expanduser(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    items = {args.only: GUIDES[args.only]} if args.only else GUIDES
    for slug, g in items.items():
        build_guide(os.path.join(out_dir, f"Matt-Grant-{slug.replace('-', ' ').title().replace(' ', '-')}-Guide.pdf"), g)
