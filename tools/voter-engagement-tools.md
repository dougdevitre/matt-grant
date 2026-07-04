# Voter Engagement Tools

Interactive tools and shareable assets that voters USE — not just read. These tools increase engagement, generate shares, capture data, and turn passive supporters into active advocates. The skill can generate the content, copy, logic, and structure for each tool. The campaign deploys them on their website, social media, or at events.

---

## Tool Catalog

### Category 1: Voting Tools (Remove Barriers to Voting)

These tools make it easier for voters to actually cast a ballot. Every barrier removed = votes gained.

#### 1. Personalized Voting Plan Builder

**What it does:** Walks a voter through 5 questions and produces a personalized voting plan with their specific polling location, hours, what to bring, and a calendar reminder.

**Questions:**
1. What's your address? → Looks up their polling location
2. Do you want to vote early, by mail, or on election day? → Shows dates and locations for their choice
3. What time of day works best? → Suggests a specific time and adds it to their calendar
4. Do you need a ride? → Offers ride-to-polls signup
5. Will you bring a friend? → Captures the friend's contact for follow-up

**Output:** A shareable "My Voting Plan" card:
```
🗳️ MY VOTING PLAN
I'm voting on: [Date]
At: [Polling Location]
Time: [Committed Time]
I'm bringing: [Friend's Name]
I support: [Candidate Name] for [Office]

[Add to Calendar button] [Share this plan]
```

**Why it works:** A voter who makes a specific plan (date, time, location) is dramatically more likely to follow through. Political science research shows plan-making interventions increase turnout by 4–9 percentage points.

**How to build:** The campaign can create this as a simple web form (React/HTML) that takes an address, queries the state's polling place lookup API, and generates the card. Or use a simpler version: a printable worksheet handed out at events and doors.

**Command:** `/votingplan` — generates the web form content, questions, logic, and shareable output card.

---

#### 2. Am I Registered? Checker

**What it does:** Provides a direct link to the voter's state voter registration lookup tool with pre-filled instructions.

**Every state has one.** The campaign wraps it with their branding and a "Not registered? Register now" CTA.

**Output:**
```
CHECK YOUR REGISTRATION

✅ Are you registered to vote?
✅ Is your address current?
✅ Do you know your polling place?

[CHECK NOW → link to state voter registration lookup]

Not registered? Register in 2 minutes:
[REGISTER → link to state online registration]

Registration deadline: [date]

Paid for by [Committee Name]
```

**Command:** `/regcheck [state]` — generates the branded registration check page with correct state links and deadlines.

---

#### 3. Election Countdown + Reminder

**What it does:** A shareable countdown graphic or widget showing days until the election, with key dates (registration deadline, early vote start, election day).

**Output:**
```
⏱️ [X] DAYS until Election Day
📝 Register by: [Date]
🗳️ Early voting: [Start Date] – [End Date]
📬 Mail ballot deadline: [Date]
🏛️ Election Day: [Date]

Your vote decides who leads [District].
[Candidate Name] for [Office] → [website]

[Share this countdown]
```

**Deploy as:** Instagram story template, Facebook post, website widget, email header.

**Command:** `/countdown [election date]` — generates countdown content for all platforms with jurisdiction-specific dates.

---

#### 4. Ride to Polls Signup

**What it does:** A simple form where voters who need transportation can request a ride on election day or during early voting.

**Fields:** Name, phone, address, preferred voting date/time, accessibility needs.

**Output to campaign:** A ride request that gets matched with a volunteer driver.

**Output to voter:** Confirmation with driver contact info and pickup details.

**Command:** `/ridesignup` — generates the form content and volunteer driver matching workflow.

---

### Category 2: Issue Tools (Connect Voters to the Candidate's Priorities)

#### 5. "Where Does [Candidate] Stand?" Issue Guide

**What it does:** A clean, scannable one-page (web or print) guide showing the candidate's position on the top 5–8 issues in plain language.

**Format per issue:**
```
📚 EDUCATION
The problem: [One sentence — local and specific]
My position: [One sentence — clear and direct]
What I'll do: [One concrete action]
```

**Why it works:** Most voters never read a candidate's full platform. A scannable issue guide with one position per issue gets read, shared, and referenced.

**Deploy as:** Website page, printable PDF, shareable social graphic (one issue per graphic), palm card back side.

**Command:** `/issueguide` — generates the complete issue guide from the candidate's positions.

---

#### 6. Side-by-Side Candidate Comparison

**What it does:** A factual, sourced comparison between the candidate and their opponent on key issues. NOT an attack piece — a factual reference.

**Format:**
```
WHERE WE STAND — [Candidate] vs. [Opponent]

| Issue | [Candidate Name] | [Opponent Name] |
|---|---|---|
| Education | [Position + action] | [Their record/position — sourced] |
| Public Safety | [Position + action] | [Their record/position — sourced] |
| Taxes | [Position + action] | [Their record/position — sourced] |
| Healthcare | [Position + action] | [Their record/position — sourced] |

Sources: [Citations for opponent's positions — votes, public statements, filings]

Paid for by [Committee Name]
```

**Why it works:** Voters WANT comparisons. Providing a factual one — before your opponent provides a misleading one — frames the race on your terms.

**Command:** `/compare [opponent name]` — generates a sourced side-by-side comparison.

---

#### 7. Issue Quiz / Values Match

**What it does:** An interactive quiz (5–8 questions) that shows voters how their values align with the candidate. Each question presents two perspectives; the voter picks the one closer to their view. At the end, they see their match percentage.

**Example questions:**
```
Q1: Which is closer to your view?
  A) "We should invest more in public schools even if it means higher taxes"
  B) "We should give parents more choices including charter and private schools"

Q2: Which is closer to your view?
  A) "Public safety means more investment in police and first responders"  
  B) "Public safety means addressing root causes like poverty and mental health"
```

**Output:**
```
🎯 You matched [X]% with [Candidate Name]!

Your top shared priorities:
✅ Education investment
✅ Small business support
✅ Infrastructure improvement

Learn more: [website]
Share your results: [share button]
```

**Why it works:** Interactive content generates 2–5x the engagement of static content. Voters who take a quiz and see a high match are primed to support the candidate. And they share their results — which is free peer-to-peer advertising.

**Important:** Design the quiz to be genuinely informative, not rigged. If a voter doesn't match on an issue, show it honestly. Credibility matters more than 100% matches.

**Command:** `/issuequiz` — generates quiz questions, answer mapping, match logic, and results page content.

---

### Category 3: Advocacy Tools (Turn Supporters into Campaigners)

#### 8. "Why I'm Voting For [Candidate]" Story Collector

**What it does:** A web form or social media prompt where supporters share — in their own words — why they're voting for the candidate. Best submissions get featured on the campaign's social media, website, and in ads.

**Prompt:**
```
WHY I'M VOTING FOR [CANDIDATE NAME]

In 2–3 sentences, tell us why you support [Candidate] 
for [Office].

Your name: ___
Your neighborhood: ___
Your story: ___

☐ I give permission to share my story on the campaign's 
  website and social media
☐ I'd be willing to record a short video testimonial

[SUBMIT]
```

**Output:** A library of authentic voter testimonials that become social media posts, website content, mail piece quotes, and ad scripts.

**Command:** `/storycollector` — generates the form, prompt, permission language, and social media post templates for featuring submissions.

---

#### 9. Personal Endorsement Card Generator

**What it does:** A supporter enters their name and one sentence about why they support the candidate. The tool generates a branded, shareable graphic — a personal endorsement card they can post on their own social media.

**Output:**
```
┌─────────────────────────────────────┐
│  I'M VOTING FOR [CANDIDATE NAME]   │
│                                     │
│  "[Supporter's one sentence]"       │
│                                     │
│  — [Supporter Name], [Neighborhood] │
│                                     │
│  Join us: [website]                 │
│  #[CandidateName]For[Office]        │
│                                     │
│  Paid for by [Committee Name]       │
└─────────────────────────────────────┘
```

**Why it works:** People trust their friends more than any candidate or ad. A supporter sharing a branded endorsement card to their personal social media reaches an entirely different network — with the credibility of a personal recommendation.

**Command:** `/endorsementcard` — generates the card template, form fields, and sharing instructions.

---

#### 10. Voter-to-Voter Relational Outreach Kit

**What it does:** Gives every supporter a toolkit to reach 5–10 people in their personal network. Includes a pre-written text message, a social media post, talking points for a conversation, and a tracking mechanism.

**The Kit:**
```
YOUR VOTER-TO-VOTER KIT

You know [Candidate Name]. Your friends and family don't — yet. 
Here's how you can help in 15 minutes:

📱 TEXT 5 FRIENDS:
"Hey [Name] — I'm supporting [Candidate] for [Office] and I 
think you'd like them. Check out their website: [URL]. 
Election day is [date]."

📲 SHARE ON SOCIAL MEDIA:
"I don't usually post about politics, but this race matters 
to me. I'm voting for [Candidate] for [Office] because 
[your reason]. Check them out: [URL] #[CandidateHashtag]"

🗣️ HAVE A CONVERSATION:
When someone asks "why do you support them?" — here are 3 things 
to say:
1. [Talking point 1 — personal, not political]
2. [Talking point 2 — the issue that resonates most]
3. [Talking point 3 — why this election matters]

📊 TRACK YOUR IMPACT:
How many people did you reach?
[Simple reply form or text-back mechanism]

Every conversation matters. Thank you for being part of this.
```

**Why it works:** This is the "relational voter contact" model — the single highest-ROI campaign tactic. See `tactics/low-cost-high-impact.md` → Tactic #17. The kit makes it EASY for supporters to do what you're already asking them to do.

**Command:** `/relationalkit` — generates the complete voter-to-voter outreach kit personalized to the campaign.

---

#### 11. Pledge to Vote Card

**What it does:** Voters sign a public pledge to vote, which gets displayed on the campaign website (with permission) as a growing wall of commitment.

**The Pledge:**
```
I PLEDGE TO VOTE

I, [Name], pledge to vote on [Election Date] in [District].

I believe my voice matters. I will:
✅ Vote on or before [Election Date]
✅ Tell at least one other person to vote
✅ Support [Candidate Name] for [Office]

[SIGN THE PLEDGE]

[X] people have already pledged. Join them.
```

**Why it works:** Public commitment increases follow-through (behavioral science: the "consistency principle"). A growing pledge count creates social proof and momentum.

**Command:** `/pledgecard` — generates the pledge form, counter, and shareable confirmation graphic.

---

#### 12. Volunteer Match Quiz

**What it does:** A quick quiz (3 questions) that matches supporters to the volunteer role that best fits their skills and availability. Better than a generic "sign up to volunteer" form.

**Questions:**
```
1. How much time can you give per week?
   ○ 1–2 hours  ○ 3–5 hours  ○ 5+ hours  ○ Just election day

2. What sounds most like you?
   ○ I love talking to people (→ canvass, phone bank)
   ○ I'm more of a behind-the-scenes person (→ data entry, event setup)
   ○ I'm great with technology (→ social media, texting, website)
   ○ I just want to help however I can (→ flexible assignment)

3. When are you available?
   ○ Weekday mornings  ○ Weekday evenings  ○ Weekends  ○ Flexible
```

**Output:**
```
🎯 YOUR BEST FIT: [Role Name]

Based on your answers, you'd be a great [Door Knocker / 
Phone Banker / Social Media Volunteer / Event Helper / 
Text Banker / Data Volunteer].

Here's your next step:
[Sign up for your first shift → link]

Thank you — this campaign runs on people like you.
```

**Command:** `/volunteermatch` — generates the quiz, role matching logic, and sign-up workflow.

---

### Category 4: Information Tools (Empower Voters with Knowledge)

#### 13. Know Your District Dashboard

**What it does:** A simple web page showing key facts about the district the candidate wants to represent: population, demographics, current representatives, recent election results, key issues, and how the district has changed.

**Why it works:** Most voters don't know basic facts about their own district. Providing this information positions the candidate as the knowledgeable, trustworthy source — and drives return traffic to the campaign website.

**Command:** `/districtdashboard` — generates the dashboard content from census data, election results, and district description.

---

#### 14. "What Does [Office] Actually Do?" Explainer

**What it does:** A plain-language explainer of the office the candidate is running for: what powers it has, what it doesn't control, how it affects daily life, and why this election matters.

**Why it works:** In low-information races (school board, county council, state legislature), most voters don't know what the office does. Educating them simultaneously positions your candidate and increases the salience of the race.

**Format:**
```
WHAT DOES YOUR [OFFICE TITLE] ACTUALLY DO?

Your [City Council Member / State Rep / School Board Member] 
makes decisions about:
✅ [Power 1 — in plain language]
✅ [Power 2]
✅ [Power 3]

They DON'T control:
❌ [Common misconception 1]
❌ [Common misconception 2]

Why it matters to YOUR life:
[1–2 sentences connecting the office to something the voter 
experiences daily — taxes, schools, roads, parks, safety]

This year's election: [Date]
Candidates: [Names]
Learn more about [Candidate Name]: [website]

Paid for by [Committee Name]
```

**Command:** `/officexplainer [office]` — generates the plain-language explainer for the specified office.

---

#### 15. Endorsement Voter Guide

**What it does:** A printable and shareable voter guide featuring endorsements from trusted organizations and individuals — formatted like the guides organizations distribute but branded to the campaign.

**Format:**
```
2026 VOTER GUIDE — [District]

[Office]: VOTE [CANDIDATE NAME] ✅

Endorsed by:
⭐ [Organization 1]
⭐ [Organization 2]
⭐ [Elected Official Name]
⭐ [Community Leader Name]

"[Pull quote from a prominent endorser]"

Election Day: [Date]
Your polling place: [Look up at [link]]
Early voting: [Dates and locations]

Paid for by [Committee Name]
```

**Deploy as:** Printable handout for churches, community centers, barber shops, laundromats, and anywhere voters gather. Also shareable as a social media graphic.

**Command:** `/voterguide` — generates the voter guide with endorsements, dates, and polling info.

---

## Deployment Strategy

### Which Tools to Build and When

| Campaign Phase | Top Voter Tools | Why Now |
|---|---|---|
| **Building (6+ months out)** | Issue guide, office explainer, district dashboard | Educate voters about the race before they tune in |
| **Fundraising (4–6 months)** | Story collector, endorsement card generator, issue quiz | Generate shareable content and capture supporter data |
| **Running (2–4 months)** | Side-by-side comparison, relational outreach kit, voter guide | Persuasion and advocacy acceleration |
| **GOTV (final 2 weeks)** | Voting plan builder, countdown, pledge card, reg checker, ride signup | Remove every barrier between supporter and ballot |

### Data Capture

Every voter tool should capture at least an email address (with permission). This feeds your email list, which is your most valuable owned audience. Tools that generate social shares extend your reach for free.

| Tool | Data Captured | Feeds Into |
|---|---|---|
| Voting plan builder | Name, email, address, voting plan | GOTV chase list, email list |
| Reg checker | Email (optional) | Email list |
| Story collector | Name, neighborhood, story, email | Social content library, email list |
| Endorsement card | Name, statement, email | Social content, endorsement page |
| Issue quiz | Email, issue priorities | Email list, voter persona data |
| Pledge card | Name, email, commitment | GOTV list, social proof counter |
| Volunteer match | Name, email, skills, availability | Volunteer database |
| Ride signup | Name, phone, address, needs | Ride-to-polls dispatch |

---

## Commands (All Voter Tools)

| Command | Output |
|---|---|
| `/votingplan` | Personalized voting plan builder: questions, logic, shareable output card |
| `/regcheck [state]` | Branded registration checker with state-specific links and deadlines |
| `/countdown [date]` | Election countdown content for all platforms with key dates |
| `/ridesignup` | Ride-to-polls signup form and volunteer driver matching workflow |
| `/issueguide` | Scannable issue guide: top 5–8 positions in plain language |
| `/compare [opponent]` | Sourced side-by-side comparison on key issues |
| `/issuequiz` | Interactive values match quiz: questions, mapping, results page |
| `/storycollector` | "Why I'm voting for..." form, prompt, and social post templates |
| `/endorsementcard` | Shareable personal endorsement card generator |
| `/relationalkit` | Voter-to-voter outreach kit: text template, social post, talking points, tracker |
| `/pledgecard` | Pledge to vote form with counter and shareable confirmation |
| `/volunteermatch` | Volunteer role matching quiz: questions, role logic, signup |
| `/districtdashboard` | District facts page: demographics, reps, election history, key issues |
| `/officexplainer [office]` | Plain-language explainer of what the office does and why it matters |
| `/voterguide` | Printable endorsement voter guide with dates and polling info |
