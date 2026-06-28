#!/usr/bin/env python3
"""
Matt Grant for Congress — branded PDF letter template.

A reusable, on-brand letterhead generator built to the campaign's
"Ledger & Banner" design system (navy authority, a single warm red accent,
accent blue for links, warm paper, hairline neutrals; serif display + sans body).

Mirrors the sophistication of the app's email/OG system: a refined masthead,
red tracked eyebrows, an accent-barred RE panel, clean lists, a faux-signature
block, and the compliant "Paid for by…" footer.

Content is passed as data so the same template renders any letter.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, ListFlowable, ListItem, Flowable, KeepTogether, PageBreak,
)
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing

# ---------------------------------------------------------------- brand tokens
INK       = HexColor("#0F2540")  # primary authority navy
FIELD     = HexColor("#16365C")  # deep field blue
ACCENT    = HexColor("#2563EB")  # campaign accent blue (links)
BRICK     = HexColor("#B5343B")  # red — urgency / accent
PAPER     = HexColor("#FBFAF6")  # warm white
PANEL     = HexColor("#F2F0E7")  # slightly deeper paper for panels
SLATE     = HexColor("#5A6472")  # muted body / captions
LINE      = HexColor("#E4E2DA")  # hairline borders
BODYINK   = HexColor("#1E2A38")  # near-black body text

DISPLAY   = "Times-Bold"
DISPLAY_I = "Times-Italic"
SANS      = "Helvetica"
SANS_B    = "Helvetica-Bold"

PAGE_W, PAGE_H = letter
LM = RM = 0.92 * inch
TOP_RESERVE = 1.86 * inch          # space the masthead occupies
BOT_RESERVE = 0.85 * inch
CONTENT_W = PAGE_W - LM - RM

# QR action band ---------------------------------------------------------------
# Vector QR is auto-sized to fill its column up to QR_MAX (drawing size in pt,
# INCLUDING the 4-module quiet zone). At QR_MAX the scannable code area is
# ~1.0 in — big enough to scan with wiggle room, small enough for a tidy band.
# The band lays out up to QR_PER_ROW codes per row (4 codes -> a 2x2 grid).
QR_MAX = 90                        # max QR drawing size (pt); ~0.98 in code area
QR_CARD_PAD = 8                    # paper margin around each QR (extra quiet zone)
QR_GUTTER = 6                      # horizontal gap between cards
QR_PER_ROW = 3                     # wrap beyond this many per row
QR_LEVEL = "M"                     # ECC level — robust for print, low density
QR_ACTIONS = [
    ("Vote",        "https://mattgrantforcongress.org/vote",   "Make your plan to vote"),
    ("Take Action", "https://mattgrantforcongress.org/act",    "Get involved"),
    ("Donate",      "https://mattgrantforcongress.org/donate", "Chip in"),
]
# Direct WinRed give — short form (no query string) for a lower-density, easier
# scan. Use in place of, or alongside, the /donate code.
WINRED_DONATE = (
    "Give Now",
    "https://secure.winred.com/matt-grant-for-congress/donate-today",
    "Donate via WinRed",
)
QR_INTRO = "Scan to make your plan to vote, get involved, or chip in."

# ------------------------------------------------------------- campaign facts
COMMITTEE = "Matt Grant for Congress"
NAMEPLATE = "MATT GRANT"
SUBPLATE  = "FOR CONGRESS"
TAGLINE   = "A neighbor, a dad, and a problem-solver."
PROMISE   = "Putting Missouri’s children first."
ADDR_1    = "1625 Mason Knoll Rd"
ADDR_2    = "St. Louis, MO 63131"
EMAIL     = "mattgrantforcongress@gmail.com"
PHONE     = "(314) 255-7760"
DISCLAIM  = "Paid for by Matt Grant for Congress."


def draw_tracked(c, x, y, text, font, size, color, tracking, right=False):
    """Draw letter-spaced text via a text object (canvas lacks setCharSpace here)."""
    if right:
        w = c.stringWidth(text, font, size) + tracking * max(len(text) - 1, 0)
        x -= w
    t = c.beginText(x, y)
    t.setFont(font, size)
    t.setFillColor(color)
    t.setCharSpace(tracking)
    t.textOut(text)
    t.setCharSpace(0)  # reset Tc so spacing doesn't leak into later text
    c.drawText(t)


# ----------------------------------------------------------------- flowables
class SectionLabel(Flowable):
    """Red tracked eyebrow with a short accent tick — mirrors the email eyebrow."""
    def __init__(self, text, color=BRICK, size=8.5, tick=True, space_before=14):
        super().__init__()
        self.text = text.upper()
        self.color = color
        self.size = size
        self.tick = tick
        self.space_before = space_before

    def getSpaceBefore(self):
        return self.space_before

    def wrap(self, aw, ah):
        self.width = aw
        self.height = self.size + 6
        return aw, self.height

    def draw(self):
        c = self.canv
        y = 3
        x = 0
        if self.tick:
            c.setFillColor(self.color)
            c.rect(0, y + 1.5, 20, 2.4, fill=1, stroke=0)
            x = 28
        draw_tracked(c, x, y, self.text, SANS_B, self.size, self.color, 1.8)


class HRule(Flowable):
    def __init__(self, width=None, color=LINE, thickness=0.75, space_before=0, space_after=0):
        super().__init__()
        self._w = width
        self.color = color
        self.thickness = thickness
        self.space_before = space_before
        self.space_after = space_after

    def getSpaceBefore(self):
        return self.space_before

    def getSpaceAfter(self):
        return self.space_after

    def wrap(self, aw, ah):
        self.width = self._w or aw
        self.height = self.thickness
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setStrokeColor(self.color)
        c.setLineWidth(self.thickness)
        c.line(0, 0, self.width, 0)


# -------------------------------------------------------------------- styles
def styles():
    s = {}
    s["date"] = ParagraphStyle("date", fontName=SANS, fontSize=9.5, leading=13,
                               textColor=SLATE, alignment=TA_RIGHT, spaceAfter=2)
    s["recip"] = ParagraphStyle("recip", fontName=SANS, fontSize=10, leading=14.5,
                                textColor=BODYINK)
    s["re"] = ParagraphStyle("re", fontName=SANS_B, fontSize=10.5, leading=15,
                             textColor=INK)
    s["body"] = ParagraphStyle("body", fontName=SANS, fontSize=10.5, leading=15.5,
                               textColor=BODYINK, spaceAfter=10)
    s["li"] = ParagraphStyle("li", fontName=SANS, fontSize=10.5, leading=14.5,
                             textColor=BODYINK, spaceAfter=3)
    s["sign_name"] = ParagraphStyle("sn", fontName=DISPLAY_I, fontSize=19, leading=22,
                                    textColor=INK)
    s["sign_meta"] = ParagraphStyle("sm", fontName=SANS, fontSize=9.5, leading=14,
                                    textColor=SLATE)
    s["qr_intro"] = ParagraphStyle("qi", fontName=SANS, fontSize=9.5, leading=13.5,
                                   textColor=SLATE, alignment=TA_CENTER)
    s["qr_label"] = ParagraphStyle("ql", fontName=SANS_B, fontSize=10, leading=12,
                                   textColor=INK, alignment=TA_CENTER, spaceBefore=2)
    s["qr_caption"] = ParagraphStyle("qc", fontName=SANS, fontSize=7.6, leading=10,
                                     textColor=SLATE, alignment=TA_CENTER, spaceBefore=2)
    return s


# ------------------------------------------------------------- page furniture
def draw_masthead(c: Canvas, doc):
    # full-bleed red top rule
    c.setFillColor(BRICK)
    c.rect(0, PAGE_H - 6, PAGE_W, 6, fill=1, stroke=0)

    top = PAGE_H - 6

    # nameplate (serif display) with hairline divider + tracked sub-plate
    name_y = top - 42
    c.setFillColor(INK)
    c.setFont(DISPLAY, 27)
    c.drawString(LM, name_y, NAMEPLATE)
    nw = c.stringWidth(NAMEPLATE, DISPLAY, 27)
    div_x = LM + nw + 14
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(div_x, name_y - 3, div_x, name_y + 19)
    draw_tracked(c, div_x + 14, name_y + 5, SUBPLATE, SANS_B, 11, FIELD, 2.6)

    # tagline beneath nameplate
    c.setFont(DISPLAY_I, 10.5)
    c.setFillColor(SLATE)
    c.drawString(LM, name_y - 16, TAGLINE)

    # right-aligned contact block — dropped to the tagline row so it clears the sub-plate
    rx = PAGE_W - RM
    cy = top - 52
    c.setFillColor(INK)
    c.setFont(SANS_B, 8.6)
    c.drawRightString(rx, cy, COMMITTEE)
    c.setFont(SANS, 8.4)
    c.setFillColor(SLATE)
    for ln in (ADDR_1, ADDR_2, f"{EMAIL}  ·  {PHONE}"):
        cy -= 11.5
        c.drawRightString(rx, cy, ln)

    # hairline rule under masthead
    rule_y = PAGE_H - TOP_RESERVE + 14
    c.setStrokeColor(LINE)
    c.setLineWidth(0.9)
    c.line(LM, rule_y, PAGE_W - RM, rule_y)
    # a short brick accent overlapping the rule, left side
    c.setStrokeColor(BRICK)
    c.setLineWidth(2.4)
    c.line(LM, rule_y, LM + 54, rule_y)


def draw_footer(c: Canvas, doc):
    fy = BOT_RESERVE - 26
    c.setStrokeColor(LINE)
    c.setLineWidth(0.75)
    c.line(LM, fy + 14, PAGE_W - RM, fy + 14)
    # left: promise (italic) · center: disclaimer · right: page number — spaced to not collide
    c.setFont(DISPLAY_I, 8)
    c.setFillColor(SLATE)
    c.drawString(LM, fy, PROMISE)
    c.setFont(SANS, 8)
    c.setFillColor(SLATE)
    c.drawRightString(PAGE_W - RM, fy, f"Page {doc.page}")
    # disclaimer on its own line beneath, centered and prominent (compliance)
    c.setFont(SANS_B, 8)
    c.setFillColor(INK)
    c.drawCentredString(PAGE_W / 2, fy - 13, DISCLAIM)


def on_page(c, doc):
    c.setTitle(getattr(doc, "title", None) or "Matt Grant for Congress — Letter")
    c.setAuthor("Matt Grant for Congress")
    draw_masthead(c, doc)
    draw_footer(c, doc)


# ------------------------------------------------------------------ qr band
def make_qr(url, size_pt=QR_MAX, color=INK, level=QR_LEVEL):
    """Crisp vector QR (navy modules) scaled to size_pt, quiet zone included."""
    w = qr.QrCodeWidget(url)
    w.barFillColor = color
    w.barStrokeColor = color
    w.barLevel = level
    x0, y0, x1, y1 = w.getBounds()
    sx, sy = size_pt / (x1 - x0), size_pt / (y1 - y0)
    d = Drawing(size_pt, size_pt, transform=[sx, 0, 0, sy, 0, 0])
    d.add(w)
    return d


def _qr_card(url, size):
    box = size + 2 * QR_CARD_PAD
    card = Table([[make_qr(url, size)]], colWidths=[box], rowHeights=[box])
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.75, LINE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), QR_CARD_PAD),
        ("RIGHTPADDING", (0, 0), (-1, -1), QR_CARD_PAD),
        ("TOPPADDING", (0, 0), (-1, -1), QR_CARD_PAD),
        ("BOTTOMPADDING", (0, 0), (-1, -1), QR_CARD_PAD),
    ]))
    return card


def _qr_row(actions, col, size, st):
    """One 3-row table (cards / labels / captions) for a row of actions."""
    cards    = [_qr_card(url, size)                    for _, url, _ in actions]
    labels   = [Paragraph(lbl.upper(), st["qr_label"]) for lbl, _, _ in actions]
    captions = [Paragraph(cap, st["qr_caption"])       for *_, cap in actions]
    t = Table([cards, labels, captions], colWidths=[col] * len(actions))
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
        ("VALIGN", (0, 1), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), QR_GUTTER),
        ("RIGHTPADDING", (0, 0), (-1, -1), QR_GUTTER),
        ("TOPPADDING", (0, 0), (-1, 0), 0),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 2),
        ("TOPPADDING", (0, 2), (-1, 2), 0),
        ("BOTTOMPADDING", (0, 2), (-1, 2), 0),
    ]))
    t.hAlign = "CENTER"
    return t


def action_band(st, actions=None, intro=QR_INTRO, eyebrow="Take Action"):
    """Reusable, toggleable QR strip. Supports any number of codes: up to
    QR_PER_ROW per row, so 4 codes render as a tidy 2x2 grid. QR size auto-fits
    the column (up to QR_MAX). Built from row-based tables — nested tables
    measure reliably, so the whole band can be kept together on one page.
    """
    actions = actions or QR_ACTIONS
    n = len(actions)
    per_row = n if n <= QR_PER_ROW else (2 if n == 4 else QR_PER_ROW)
    col = CONTENT_W / per_row
    size = min(QR_MAX, col - 2 * QR_GUTTER - 2 * QR_CARD_PAD)

    rows = [actions[i:i + per_row] for i in range(0, n, per_row)]
    block = [SectionLabel(eyebrow, space_before=0), Spacer(1, 5),
             Paragraph(intro, st["qr_intro"]), Spacer(1, 10)]
    for i, chunk in enumerate(rows):
        if i:
            block.append(Spacer(1, 12))
        block.append(_qr_row(chunk, col, size, st))

    # Keep the band intact so a card row never splits from its labels.
    return [Spacer(1, 8), KeepTogether(block)]


# ------------------------------------------------------------------ assembler
def re_panel(re_html, st):
    """RE: line in an accent-barred panel."""
    para = Paragraph(re_html, st["re"])
    t = Table([["", para]], colWidths=[4, CONTENT_W - 4])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), BRICK),
        ("BACKGROUND", (1, 0), (1, 0), PANEL),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 14),
        ("RIGHTPADDING", (1, 0), (1, 0), 14),
        ("TOPPADDING", (1, 0), (1, 0), 11),
        ("BOTTOMPADDING", (1, 0), (1, 0), 11),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def make_list(items, st, numbered):
    bt = "1" if numbered else "bullet"
    li = [ListItem(Paragraph(x, st["li"]), value=i + 1) for i, x in enumerate(items)] \
        if numbered else [ListItem(Paragraph(x, st["li"]), bulletColor=BRICK) for x in items]
    return ListFlowable(
        li, bulletType=bt,
        bulletFontName=SANS_B, bulletFontSize=10.5, bulletColor=BRICK,
        leftIndent=22, bulletDedent=14, spaceBefore=2, spaceAfter=8,
    )


def letter_story(content, st):
    """Build the flowables for one letter. Every block is optional, so the same
    function renders a full letter or a simpler one-pager (e.g. an enclosure
    brief with no recipient/RE/signature)."""
    story = []
    if content.get("date"):
        story.append(Paragraph(content["date"], st["date"]))
        story.append(Spacer(1, 10))
    if content.get("recipient"):
        story.append(Paragraph(content["recipient"], st["recip"]))
        story.append(Spacer(1, 16))
    if content.get("eyebrow"):
        story.append(SectionLabel(content["eyebrow"], space_before=0))
        story.append(Spacer(1, 8))
    if content.get("re"):
        story.append(re_panel(content["re"], st))
        story.append(Spacer(1, 18))
    for p in content.get("intro", []):
        story.append(Paragraph(p, st["body"]))

    for sec in content.get("sections", []):
        story.append(SectionLabel(sec["label"]))
        story.append(Spacer(1, 7))
        for blk in sec["blocks"]:
            kind = blk[0]
            if kind == "p":
                story.append(Paragraph(blk[1], st["body"]))
            elif kind == "ol":
                story.append(make_list(blk[1], st, numbered=True))
            elif kind == "ul":
                story.append(make_list(blk[1], st, numbered=False))

    for p in content.get("closing", []):
        story.append(Paragraph(p, st["body"]))

    # signature — kept together so the sign-off never orphans from the name
    if content.get("sign_name"):
        sig = [
            Paragraph(content.get("signoff", "Sincerely,"), st["body"]),
            Spacer(1, 6),
            Paragraph(content["sign_name"], st["sign_name"]),
            HRule(width=180, color=LINE, thickness=0.75, space_before=2, space_after=6),
        ]
        sig += [Paragraph(m, st["sign_meta"]) for m in content.get("sign_meta", [])]
        story.append(Spacer(1, 8))
        story.append(KeepTogether(sig))

    # optional, reusable "Take Action" QR band — off for formal letters
    if content.get("action_band"):
        story.extend(action_band(
            st,
            actions=content.get("qr_actions"),
            intro=content.get("qr_intro", QR_INTRO),
            eyebrow=content.get("qr_eyebrow", "Take Action"),
        ))
    return story


def _new_doc(out_path, title):
    doc = BaseDocTemplate(
        out_path, pagesize=letter,
        leftMargin=LM, rightMargin=RM,
        topMargin=TOP_RESERVE, bottomMargin=BOT_RESERVE,
        title=title,
    )
    frame = Frame(LM, BOT_RESERVE, CONTENT_W,
                  PAGE_H - TOP_RESERVE - BOT_RESERVE, id="body",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])
    return doc


def build(out_path, content):
    doc = _new_doc(out_path, content.get("title", "Matt Grant for Congress — Letter"))
    doc.build(letter_story(content, styles()))


def build_many(out_path, contents, title="Matt Grant for Congress — Mailing"):
    """Render many letters into ONE PDF, each starting on a fresh page —
    a print-ready mail-merge. `contents` is a flat list of content dicts."""
    doc = _new_doc(out_path, title)
    st = styles()
    story = []
    for i, c in enumerate(contents):
        if i:
            story.append(PageBreak())
        story.extend(letter_story(c, st))
    doc.build(story)


# ------------------------------------------------------------------- content
CONTENT = {
    "title": "Sunshine Law Request — Voter List, MO-02",
    "date": "June 24, 2026",
    "recipient": (
        "Missouri Secretary of State<br/>"
        "Elections Division<br/>"
        "<b>ATTN: Custodian of Records</b><br/>"
        "600 West Main Street<br/>"
        "Jefferson City, MO 65101<br/>"
        "Elections: (573) 751-2301"
    ),
    "eyebrow": "Open Records · Sunshine Law Request",
    "re": (
        "<b>RE:</b>&nbsp; Registered Voter List, Missouri’s 2nd Congressional "
        "District &mdash; RSMo §§ 115.157, 115.163, and Chapter 610"
    ),
    "intro": [
        "Dear Custodian of Records:",
        "Pursuant to the Missouri Sunshine Law (Chapter 610, RSMo) and the "
        "voter-list provisions of RSMo §§ 115.157 and 115.163, I request a "
        "copy of the statewide voter registration list, limited to the counties "
        "and precincts comprising Missouri’s 2nd Congressional District.",
        "I am a candidate for the office of U.S. Representative, Missouri 2nd "
        "Congressional District, in the August 4, 2026 primary election. This "
        "request is made for lawful election-related purposes only, and the data "
        "will not be used for any commercial purpose.",
    ],
    "sections": [
        {
            "label": "Data Requested",
            "blocks": [
                ("p", "Please provide, in electronic format (CSV preferred; "
                      "otherwise the standard delimited export), the fields "
                      "authorized for release under § 115.157, including for "
                      "each registered voter:"),
                ("ol", [
                    "Unique voter identification number",
                    "Voter name (first, middle, last, suffix)",
                    "Year of birth",
                    "Residential address (and mailing address, if different)",
                    "Township or ward",
                    "Precinct",
                    "Voter participation / vote history (elections in which the "
                    "voter participated), to the extent maintained and releasable "
                    "under § 115.157.2",
                ]),
            ],
        },
        {
            "label": "Scope",
            "blocks": [
                ("ul", [
                    "Geographic scope: all precincts within the 2nd Congressional "
                    "District (or, if the office furnishes only complete-county "
                    "files, the full files for each county wholly or partially "
                    "within the district).",
                    "If the District spans portions of a county, please include "
                    "the full county file and indicate the precinct/district field "
                    "so records can be filtered.",
                ]),
            ],
        },
        {
            "label": "Format & Delivery",
            "blocks": [
                ("ul", [
                    "Preferred: electronic delivery (secure download link or "
                    "encrypted media).",
                    "If electronic delivery is unavailable, please advise on "
                    "physical media.",
                ]),
            ],
        },
        {
            "label": "Fees",
            "blocks": [
                ("p", "I understand a reasonable fee applies under § 115.157 "
                      "and § 610.026. Please provide a written cost estimate "
                      "before processing if the total will exceed <b>$50</b>. I "
                      "authorize charges up to <b>$100</b> without further "
                      "approval."),
            ],
        },
        {
            "label": "Response",
            "blocks": [
                ("p", "Please acknowledge receipt and provide the records, an "
                      "estimate, or any statutory basis for delay or denial within "
                      "the timeframe required by § 610.023. If any portion is "
                      "withheld, please cite the specific exemption."),
            ],
        },
    ],
    "closing": [
        "I am happy to complete any standard data-request form or data-use "
        "agreement your office requires. Please direct questions to me at "
        f"{PHONE} or {EMAIL}.",
        "Thank you for your assistance.",
    ],
    "signoff": "Sincerely,",
    "sign_name": "Matt Grant",
    "sign_meta": [
        "<b>Matt Grant</b>",
        "Candidate, U.S. Representative — Missouri 2nd Congressional District",
        "Matt Grant for Congress",
    ],
}


if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "sunshine-request.pdf"
    build(out, CONTENT)
    print("wrote", out)
