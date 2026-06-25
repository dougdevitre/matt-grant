# One-Sheet System

```mermaid
flowchart TD
    A[One-Sheet\nSystem] --> B[Investor\nOne-Sheet]
    A --> C[Product\nOne-Sheet]
    A --> D[Speaker\nOne-Sheet]
    B --> E[Fundraising\nLeave-Behind]
    C --> F[Customer\nLeave-Behind]
    D --> G[Event Booking\nLeave-Behind]

    style A fill:#1e3a5f,stroke:#4a90d9,color:#ffffff
    style B fill:#2d5a27,stroke:#5cb85c,color:#ffffff
    style C fill:#7a4f00,stroke:#f0ad4e,color:#ffffff
    style D fill:#5a1a2a,stroke:#d9534f,color:#ffffff
    style E fill:#2d5a27,stroke:#5cb85c,color:#ffffff
    style F fill:#7a4f00,stroke:#f0ad4e,color:#ffffff
    style G fill:#5a1a2a,stroke:#d9534f,color:#ffffff
```

## What Is a One-Sheet?

A one-sheet is a single-page document that delivers a complete, compelling story in under 60 seconds of reading. It is the physical or digital leave-behind after a pitch, call, or meeting.

**Three types in this system:**
1. **Investor One-Sheet** — Sent with or after a fundraising pitch
2. **Product One-Sheet** — Sent after a customer discovery call or demo
3. **Speaker One-Sheet** — Sent to conference organizers or event bookers

**Design rule for all one-sheets:** Print must work on standard US Letter (8.5" × 11") or A4. Digital must read clearly on mobile without pinching or zooming.

---

## DESIGN SPECS — ALL ONE-SHEETS

### Canvas
- **Size:** US Letter — 8.5" × 11" (2550 × 3300px at 300 DPI for print)
- **Digital:** Export as PDF at 150 DPI for email; 72 DPI for screen-only
- **Margins:** 0.5" (36px at 72 DPI) on all sides minimum
- **Safe zone:** Keep all content 0.75" from edges for print bleed safety

### Grid
- **Columns:** 2-column layout (primary content 65%, sidebar 35%) or 3-column equal grid
- **Gutter:** 0.25" between columns
- **Section dividers:** 1px rule in brand color, or 12px vertical white space

### Typography (for print at 8.5" × 11")
| Element | Size | Weight |
|---------|------|--------|
| Company name / headline | 28–36pt | Bold |
| Section headers | 14–16pt | Bold or SemiBold |
| Body copy | 9–10pt | Regular |
| Captions / labels | 8pt | Regular or Medium |
| Contact info | 9–10pt | Regular |

**Minimum readable size for print:** 8pt. Digital: 11pt.

### Colors
Use your brand color system from `deck-design-system.md`.
One-sheets can use a colored header band (full bleed) or a white background with color accents.

### Recommended Tools
- **Canva** — fastest for non-designers; excellent templates; print-ready export
- **Figma** — most control; good for matching deck design exactly
- **Adobe InDesign** — professional print production
- **Google Slides / PowerPoint** — set page size to 8.5" × 11" and export as PDF

---

## ONE-SHEET 1: INVESTOR ONE-SHEET

### Purpose
Sent as an attachment with your cold investor email, or handed over after an investor meeting. Investors see many decks — a sharp one-sheet is often read more carefully than a 12-slide deck.

### Layout (8.5" × 11", portrait)

```
┌─────────────────────────────────────────────────────┐
│ [HEADER BAND — full width, brand color]              │
│ [Logo — left]     [Company Name — center, large]    │
│                   [Tagline — center, smaller]        │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ THE PROBLEM          │  │ THE SOLUTION              │
│ [2–3 sentences]      │  │ [2–3 sentences]           │
│                      │  │                           │
│ [Specific pain       │  │ [Product description +    │
│ quantified]          │  │ key mechanism]            │
└──────────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ TRACTION                                            │
│                                                     │
│  [METRIC]      [METRIC]      [METRIC]      [METRIC] │
│  $12K MRR      200 Users     20% MoM       3 Pilots │
│  [label]       [label]       [label]       [label]  │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ MARKET               │  │ BUSINESS MODEL            │
│ TAM: $[X]B           │  │ [Subscription / Usage /   │
│ SAM: $[X]M           │  │ Transaction model]        │
│ Beachhead:           │  │ Starting at $[X]/month    │
│ [segment]            │  │ [Key economics: LTV/CAC]  │
└──────────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ THE TEAM                                            │
│ [Headshot] [Name] — [Title] — [1-line credential]  │
│ [Headshot] [Name] — [Title] — [1-line credential]  │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ THE ASK              │  │ USE OF FUNDS              │
│ Raising: $[X]        │  │ [X]% Product              │
│ Instrument: [SAFE]   │  │ [X]% Sales & Marketing    │
│ Cap: $[X]M           │  │ [X]% Team                 │
│ Milestone: [X]       │  │                           │
└──────────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ [Name] │ [Email] │ [Phone] │ [Website] │ [LinkedIn] │
│ [QR code linking to deck or data room — optional]   │
└─────────────────────────────────────────────────────┘
```

### Copy Templates (fill in your content)

**Header:**
```
[COMPANY NAME]
[Tagline — 60 characters max — see marketing-copy-library.md]
```

**Problem block (60–80 words):**
```
[Specific customer] faces [specific problem].
Today, they [workaround — what they do now].
This costs them [specific consequence: time / money / legal risk / safety].
[What's missing that should exist].
```

**Solution block (60–80 words):**
```
[Company] is a [category] that [what it does in 2 sentences].
Unlike [alternative], [key differentiator — be specific].
[One sentence on the mechanism: how it works].
```

**Traction bar (4 metrics, each with label — ≤10 characters per metric):**
```
Metric 1: [Number] — [Label: "MRR" / "ARR" / "Users"]
Metric 2: [Number] — [Label: "Growth MoM" / "Customers"]
Metric 3: [Number] — [Label: "Retention" / "Pilots" / "Runway"]
Metric 4: [Number or date] — [Label: "Founded" / "Team" / "NPS"]
```

**Market block (40–50 words):**
```
Total addressable market: $[X]B ([source])
Serving initially: [beachhead segment] — $[X]M
Growth rate: [X]% CAGR ([year range])
Why now: [1 sentence on market timing]
```

**Business model block (40–50 words):**
```
Revenue model: [Subscription / Usage / Transaction]
Pricing: Starting at $[X]/[month or year]
Gross margin: [X]%
LTV:CAC: [X]x
CAC Payback: [X] months
```

**Team block (1–2 lines per person):**
```
[Name] — [Title] — [Most relevant credential in 8–10 words]
[Name] — [Title] — [Most relevant credential in 8–10 words]
```

**The Ask block (30–40 words):**
```
Raising: $[X] on a [postmoney SAFE / priced seed]
Valuation cap: $[X]M
Closing: [Month Year] — [X]% soft-circled
This round funds: [Product / GTM / Hiring] to reach [specific milestone]
```

---

## ONE-SHEET 2: PRODUCT ONE-SHEET

### Purpose
Sent after a customer demo call, left behind after a sales meeting, or used as a sales enablement tool for partners and resellers.

### Layout (8.5" × 11", portrait)

```
┌─────────────────────────────────────────────────────┐
│ [HEADER BAND]                                        │
│ [Logo]         [Product Name]      [Tagline]        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ [HERO — product screenshot or illustration]          │
│ [Centered, high quality, 3–4 inches tall]           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ "Customer Quote — short, specific, powerful"        │
│ — [Name, Title, Company]                            │
└─────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ HOW IT WORKS                                         │
│                                                      │
│ ① [Step 1 icon] [Step name]    [1-line description] │
│ ② [Step 2 icon] [Step name]    [1-line description] │
│ ③ [Step 3 icon] [Step name]    [1-line description] │
└──────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ KEY BENEFITS         │  │ WHO IT'S FOR              │
│ • [Benefit 1]        │  │ • [Customer type 1]       │
│ • [Benefit 2]        │  │ • [Customer type 2]       │
│ • [Benefit 3]        │  │ • [Customer type 3]       │
│ • [Benefit 4]        │  │                           │
└──────────────────────┘  └──────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ RESULTS OUR CUSTOMERS SEE                           │
│  [Stat 1]         [Stat 2]         [Stat 3]        │
│  "40% less time"  "3x faster"      "Zero missed"   │
│  on intake        documentation    incidents        │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────────┐
│ PRICING              │  │ GET STARTED               │
│ [Tier 1] $[X]/mo    │  │ [Website]                 │
│ [Tier 2] $[X]/mo    │  │ [Email]                   │
│ [Enterprise] Custom  │  │ [Phone]                   │
│ 14-day free trial   │  │ [Schedule a demo: URL]     │
└──────────────────────┘  └──────────────────────────┘
```

### Copy Templates

**Product hero headline (40–60 characters):**
```
[Outcome the customer achieves — not a feature name]
Example: "Court-ready documentation. Automated."
```

**How it works (3 steps, each ≤ 15 words):**
```
Step 1: [Action] — [What happens and why it matters]
Step 2: [Action] — [What happens and why it matters]
Step 3: [Outcome] — [What they now have]
Example:
① Document — Log incidents, exchanges, and communications in seconds
② Organize — Everything auto-sorted by date, type, and relevance
③ Present — Export court-ready packages with one click
```

**Key benefits (4–5 bullets, each ≤ 12 words):**
```
• [Benefit framed as outcome — no jargon]
• [Benefit framed as outcome]
• [Benefit framed as outcome]
• [Benefit framed as outcome]
```

**Results section (3 stats with context):**
```
Stat 1: [Number] — [What it means in context]
Stat 2: [Number] — [What it means in context]
Stat 3: [Number] — [What it means in context]
```

---

## ONE-SHEET 3: SPEAKER ONE-SHEET

### Purpose
Sent to event organizers, conference program committees, and speaker bureaus. Also used as a media kit component.

### Layout (8.5" × 11", landscape or portrait — landscape preferred for speaker materials)

```
┌────────────────────────────────────────────────────────────────┐
│ [HEADER — speaker name large, credential line]                  │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌──────────────────────────────────────┐
│ [HEADSHOT]          │  │ ABOUT [NAME]                         │
│ [Professional,      │  │ [100-word bio — see marketing-copy-  │
│ high quality,       │  │ library.md for bio variants]         │
│ 3" × 4" minimum]   │  │                                      │
│                     │  │ EXPERTISE                            │
│ [Logo of company]   │  │ • [Topic area 1]                    │
│                     │  │ • [Topic area 2]                    │
│ [Contact info]      │  │ • [Topic area 3]                    │
└─────────────────────┘  └──────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ SIGNATURE TALKS                                                 │
│                                                                 │
│ TALK 1: "[Title]"                                              │
│ [2–3 sentences: what the talk covers, key takeaways, who       │
│ it's for. Audience: [type]. Length: [45/60/90 min].]          │
│                                                                 │
│ TALK 2: "[Title]"                                              │
│ [Same format]                                                   │
│                                                                 │
│ TALK 3: "[Title]"                                              │
│ [Same format]                                                   │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌──────────────────────────────────────┐
│ PAST SPEAKING       │  │ WHAT AUDIENCES SAY                   │
│ • [Event, Year]     │  │ "[Quote from event organizer or      │
│ • [Event, Year]     │  │ attendee — specific and strong]"    │
│ • [Event, Year]     │  │ — [Name, Title, Event]              │
│ • [Event, Year]     │  │                                      │
│ • [Event, Year]     │  │ "[Second quote]"                    │
│                     │  │ — [Name, Title, Event]              │
└─────────────────────┘  └──────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ [Name] is available for keynotes, panels, workshops, and       │
│ virtual presentations.                                          │
│ [Email] │ [Phone] │ [Website] │ [LinkedIn] │ [Demo reel URL]  │
└────────────────────────────────────────────────────────────────┘
```

### Copy Templates

**Speaker name/credential line (60 characters max):**
```
[Name] | Founder, [Company] | [Domain Expert Title]
Example: "Doug DeVitre | Founder, CoTrackPro | Family Law Technology Speaker"
```

**Talk title (50 characters max):**
```
["[Counterintuitive claim or outcome promise]"]
Examples:
- "Why Most Co-Parents Lose in Court Before They Ever Walk In"
- "Documentation as a Legal Strategy: What Family Law Has Gotten Wrong"
- "The Tech Stack Transforming High-Conflict Family Cases"
```

**Talk description (60–80 words):**
```
[What the talk covers — lead with the audience's problem]
[Key takeaways — 3 bullets the audience will walk away with]
Audience: [Who benefits most — attorneys / mediators / families / clinicians]
Length: [45 / 60 / 90 minutes] | Format: [Keynote / Workshop / Panel]
```

**Testimonial (30–50 words):**
```
"[What changed for the audience / what the speaker uniquely delivered.
Name the specific value, not generic praise.]"
— [Name], [Title], [Organization], [Event Name]
```

---

## ONE-SHEET QUALITY CHECKLIST

```
CONTENT
[ ] Company name and logo on the sheet
[ ] Tagline clearly visible
[ ] Problem stated in customer's language (not product language)
[ ] Solution described with outcome focus
[ ] At least 1 real number as social proof
[ ] Clear call to action (what to do next)
[ ] Contact info: email, phone, website, and LinkedIn minimum

DESIGN
[ ] Readable at arm's length (no text below 9pt for print)
[ ] Max 2 colors beyond black and white
[ ] All images high resolution (300 DPI for print)
[ ] White space — not cramped
[ ] Consistent alignment — nothing looks accidentally placed
[ ] PDF exported and tested on phone (does it read without zooming?)

BEFORE SENDING
[ ] Proofread by someone who doesn't work at the company
[ ] Company name spelled correctly (including capitalization)
[ ] All URLs tested and working
[ ] All phone numbers formatted correctly
[ ] File named: [CompanyName]_[Type]OneSheet_[Date].pdf
```
