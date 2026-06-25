# Job Seeker Experience Modules
## Access to Jobs Modules 14–18 — Advanced Job Seeker Tools

---

```mermaid
flowchart TD
    subgraph ADV ["Advanced Job Seeker Journey"]
        M14[Module 14: Readiness Assessment<br/>7-dimension scorecard] --> GAP{Top 3 gaps?}
        GAP -->|Resume weak| M2[Module 2: Resume]
        GAP -->|No LinkedIn| M16[Module 16: LinkedIn Builder]
        GAP -->|Interview skills| M7[Module 7: Interview Prep]
        GAP -->|Need training| M9[Module 9: Training Pathways]
    end
    
    subgraph POST ["Post-Hire Success"]
        HIRED[Got Hired!] --> M15[Module 15: Retention Plan]
        M15 --> W1[Week 1: Learn + Listen]
        W1 --> D30[Days 8-30: Build Trust]
        D30 --> D60[Days 31-60: Demonstrate Competence]
        D60 --> D90[Days 61-90: Establish Yourself]
    end
    
    subgraph EARN ["Maximize Earnings"]
        M18[Module 18: Salary Guidance] --> NEG[Negotiation Framework]
        NEG --> TC[Total Compensation Calculator<br/>Salary + Benefits + PTO + Retirement]
        TC --> COMP[Compare Offers<br/>Side by Side]
    end

    style M14 fill:#2563eb,color:#fff
    style HIRED fill:#059669,color:#fff
    style M18 fill:#d97706,color:#fff
    style TC fill:#dc2626,color:#fff
```

---

## MODULE 14: EMPLOYMENT READINESS ASSESSMENT

**Goal:** Give job seekers an honest, scored snapshot of where they stand and exactly what to fix.

**Use when:** "Am I ready to apply?" / "How competitive am I?" / "Where do I start?" / Coach Mode

**Collect from user:** target job title, current situation (unemployed, employed, reentry, etc.),
and any resume/work history context already in the conversation.

**Output format:**

```
## Employment Readiness Assessment
### Target: [Job Title] | Date: [Today]

SCORE CARD (1 = needs work, 5 = strong)

[ ] Resume ............ [1-5] — [1-sentence diagnosis]
[ ] Cover letter ...... [1-5] — [1-sentence diagnosis]
[ ] Skills match ...... [1-5] — [1-sentence diagnosis]
[ ] Application volume . [1-5] — [1-sentence diagnosis]
[ ] Interview prep .... [1-5] — [1-sentence diagnosis]
[ ] Program enrollment . [1-5] — [1-sentence diagnosis: WIOA / training / SkillUP etc.]
[ ] Online presence ... [1-5] — [1-sentence diagnosis: LinkedIn, etc.]

OVERALL: [total / 35] — [Needs foundation / Building momentum / Competitive / Job-ready]

TOP 3 GAPS TO CLOSE (in priority order):
1. [Gap] → [Specific action to take this week]
2. [Gap] → [Specific action to take this week]
3. [Gap] → [Specific action to take this week]

YOUR SINGLE NEXT ACTION (do this today):
→ [One concrete, specific task]

ESTIMATED TIME TO COMPETITIVE:
[ ] Under 2 weeks  [ ] 2–4 weeks  [ ] 1–2 months  [ ] 2+ months
```

**Scoring rubric guidance:**

| Area | Score 1 | Score 3 | Score 5 |
|---|---|---|---|
| Resume | None or severely outdated | Generic, not tailored | ATS-optimized, JD-matched |
| Cover letter | None | Generic template | Tailored, compelling |
| Skills match | <40% of JD requirements | 60% match | 80%+ match or trainable gap |
| App volume | 0–2 apps sent | 5–10 apps/week | 10+ apps with follow-ups |
| Interview prep | Never practiced | Reviewed some questions | STAR answers rehearsed |
| Program enrollment | None | Aware of programs | Actively enrolled |
| Online presence | No LinkedIn | Basic profile exists | Complete, active LinkedIn |

---

## MODULE 15: JOB RETENTION — 30/60/90-DAY PLAN

**Goal:** Set a new hire up for success with a structured first-90-days plan.

**Use when:** "I just got hired" / "I start a new job" / "how do I keep this job" / "what do I do first week"

**Collect:** job title, industry, whether it's first job/return to work/career change.

**Output:**

```
## Your First 90 Days: [Job Title]

### Week 1 — Learn and listen
- [ ] Arrive 10–15 minutes early every day
- [ ] Learn your supervisor's name and preferred communication style
- [ ] Identify 2–3 coworkers who've been there longest — observe them
- [ ] Ask: "What does success look like in this role in the first 30 days?"
- [ ] Write down every question you have — review at week's end

### Days 8–30 — Build trust
- [ ] Complete all required training without shortcuts
- [ ] Meet deadlines consistently — reliability is the #1 trait employers cite
- [ ] Volunteer for small tasks that others avoid (shows initiative)
- [ ] Avoid: gossip, phone use on the floor, excessive socializing during work time
- [ ] Ask for feedback at 30-day mark: "Is there anything I should be doing differently?"

### Days 31–60 — Demonstrate competence
- [ ] Identify one process you can do better than when you started
- [ ] Begin building relationships across departments (not just your team)
- [ ] If benefit enrollment is open, complete it
- [ ] Note any skills gaps you're seeing — flag for potential training

### Days 61–90 — Establish yourself
- [ ] Complete 90-day review if offered — come prepared with examples of your contributions
- [ ] Set a 6-month goal with your supervisor
- [ ] If you have WIOA training tied to this job, notify your case manager of employment
- [ ] Update your resume with the new role (while details are fresh)

### Warning signs to address early
- Repeated lateness → apologize once, fix immediately, never repeat
- Conflict with a coworker → address privately, not publicly; involve supervisor only if unresolved
- Feeling overwhelmed → tell your supervisor; most prefer honesty to a quiet spiral
- Pay or schedule issues → address promptly through proper channels (HR, supervisor)

WIOA follow-up note:
If you're enrolled in WIOA, your case manager will check in at Q2 and Q4 post-exit.
Keep their contact info and report your employment status promptly.
```

---

## MODULE 16: LINKEDIN PROFILE BUILDER

**Goal:** Build a complete, job-search-ready LinkedIn profile from scratch or improve an existing one.

**Use when:** "help me build LinkedIn" / "LinkedIn profile" / "help me get found by recruiters"

**Sections to generate:**

### Headline (most important — drives search ranking)
```
Formula: [What you do] + [Who you help] + [Result/Specialty]
Example: "CNA | Compassionate Patient Care | 3+ Years in Long-Term Care"
Example: "Warehouse Operations | Forklift Certified | Seeking St. Charles County Opportunities"
Example: "Transitioning Veteran | Logistics & Supply Chain | DOD TS/SCI Clearance"

NOT: "Looking for opportunities" or "Unemployed" — never signal desperation
```

### About / Summary (500 words max, first 2–3 lines visible before "see more")
```
[2-sentence hook: who you are + what you bring]
[2–3 sentences: key skills and what makes you different]
[1 sentence: what you're looking for]

Example:
"Manufacturing professional with 8 years in quality control and production operations.
Known for reducing defect rates and training new team members on safety protocols.
Forklift certified, OSHA 10 trained, and experienced with SAP inventory systems.
Open to production supervisor or quality assurance roles in the St. Charles / St. Louis area."
```

### Experience section
- Mirror the resume format: action verb + what you did + result
- Include WIOA training, apprenticeship, SkillUP completion, DOC vocational programs as experience
- Volunteer work and community roles count

### Skills section
- Add 10–15 skills matching your target job descriptions
- Skills with endorsements rank higher — ask 2–3 colleagues to endorse you
- Industry-specific skills score higher than generic ones

### Connections strategy
```
Day 1: Connect with former supervisors and coworkers (warm connections)
Day 2: Connect with Job Center staff / career advisors
Day 3: Follow target companies (Boeing, SSM Health, World Wide Technology, etc.)
Week 2: Join 2–3 LinkedIn Groups in your field
Week 3: Comment thoughtfully on 1–2 posts per week (increases visibility)
```

**Privacy note for reentry applicants:** LinkedIn is public. Adjust privacy settings to
control what shows. You are never required to include a photo or list every employer.
Focus on skills and forward momentum.

---

## MODULE 17: JOB FAIR PREP KIT

**Goal:** Prepare job seekers to perform at peak at hiring events, job fairs, and employer meet-and-greets.

**Use when:** "job fair" / "hiring event" / "employer event this week" / "how do I prepare for a job fair"

**Output:**

```
## Job Fair Prep Kit

### Before the event (2–3 days before)
- [ ] Research the 5 employers you most want to talk to — know what they do
- [ ] Tailor your elevator pitch to each target employer
- [ ] Print 15–20 copies of your resume (clean, no typos)
- [ ] Prepare a business card if possible (name, phone, email, LinkedIn)
- [ ] Dress: one level above what the job requires
       - Office role → business professional
       - Trades/warehouse → clean business casual
       - Healthcare → business casual or scrubs if appropriate

### Your elevator pitch (30–45 seconds)
"Hi, I'm [Name]. I have [X years] of experience in [field], and I'm specifically interested
in [Company] because [specific reason you researched]. I'm looking for a role where I can
[specific contribution]. Do you have openings in [area]?"

Practice it 10 times before you go.

### At the event
- [ ] Arrive early (first 30 minutes = least crowded, freshest recruiters)
- [ ] Start with your 2nd-tier targets to warm up, then approach your top choices
- [ ] Ask smart questions: "What does success look like in this role's first 90 days?"
- [ ] Ask for a business card from every recruiter you speak with
- [ ] Write a 2–3 word note on the back of each card (for your follow-up)
- [ ] Do NOT: sit down, be on your phone, eat while talking to employers, badmouth previous employers

### After the event (within 24 hours)
- [ ] Send a follow-up email to each recruiter you connected with
- [ ] Connect with them on LinkedIn with a personalized note
- [ ] If they invited you to apply, apply that same day

### Follow-up email template
Subject: Great speaking with you at [Event Name] — [Name]

Dear [Recruiter Name],

It was a pleasure speaking with you about [Company]'s opportunities today at [Event].
Our conversation about [specific thing discussed] reinforced my interest in [role].

I've attached my resume and will also be applying through [Company's website / system].
Thank you again for your time — I look forward to staying in touch.

Best,
[Name] | [Phone] | [Email] | [LinkedIn URL]
```

---

## MODULE 18: SALARY NEGOTIATION & WAGE GUIDANCE

**Goal:** Help job seekers understand fair market wages and negotiate confidently.

**Use when:** "how much should I ask for" / "they offered me X" / "salary negotiation" / "is this a good offer"

**Missouri wage context:**
- Missouri minimum wage 2025: $13.75/hour (check current rate)
- Living wage estimate for St. Charles County single adult: approximately $18–22/hour
- WIOA median earnings target (Adult program, Q2 after exit): tracked statewide

**Wage research guidance:**
- Missouri Connections (missouriconnections.org) → occupational profiles include wage data
- MERIC (Missouri Economic Research and Information Center): regional wage data
- BLS Occupational Employment Statistics: federal wage benchmarks
- jobs.mo.gov → Labor Market Information

**Negotiation framework:**

```
STEP 1 — Know your range before you enter
Research: minimum acceptable | target | stretch
Example for CNA in St. Charles: Min $15/hr | Target $17/hr | Stretch $19/hr

STEP 2 — Let them go first
"What is the salary range for this position?"
Never give your number first if you can avoid it.

STEP 3 — If the offer is low
"Thank you for the offer. Based on my [specific experience/skill/certification],
I was expecting something closer to [target number]. Is there flexibility there?"

STEP 4 — If they can't move on base wage, ask about:
- Sign-on bonus
- Earlier performance review (3 months instead of 6)
- Extra PTO days
- Flexible schedule or remote day
- Training reimbursement

STEP 5 — Get it in writing
"I'm excited about this opportunity. Could you put the offer in writing so I can
review the complete package?"

NEVER accept verbally and decline in writing. If you accept, you've accepted.
Take 24 hours to review the written offer before signing.
```

**WIOA wage note:** If you're enrolled in WIOA, your wages at Q2 post-exit are tracked as
a performance metric. This is not a reason to reject a lower offer — any employed outcome
is better than no employment — but your case manager can help you evaluate offers.

**WOTC note for job seekers:** If you qualify for WOTC (veteran, ex-felon, SNAP recipient,
long-term unemployed, etc.), some employers specifically seek WOTC-eligible candidates.
This can slightly strengthen your position in negotiation — you're bringing a tax benefit.
Ask your Job Center staff if you qualify.

---

## TOTAL COMPENSATION CALCULATOR

**Goal:** Help job seekers see the FULL value of a job offer — not just the paycheck.

**Why this matters:**
Base salary is only 60–75% of what an employer actually pays to employ you. Two jobs that
both pay $40,000/year can differ by $15,000–$25,000 in total value when you add benefits.
A "lower paying" government job often beats a "higher paying" private sector job when you
count health insurance, pension, and paid leave.

### WHAT IS TOTAL COMPENSATION?

Total compensation = everything the employer provides that has financial value:

```
BASE SALARY (your paycheck)
  + Health insurance (employer's share of premium)
  + Dental and vision insurance (employer's share)
  + Retirement contributions (employer match / pension)
  + Paid time off (vacation, sick, holidays — in dollar value)
  + Life insurance (employer-paid)
  + Disability insurance (employer-paid)
  + Other benefits (tuition, bonuses, FSA/HSA, etc.)
  ─────────────────────────────────────────
  = TOTAL COMPENSATION (what the job is actually worth)
```

### HOW TO CALCULATE EACH COMPONENT

**Health insurance — often the biggest benefit (worth $6,000–$22,000/year)**
```
Ask the employer: "What does the employee pay per paycheck for health insurance?"
  → Typical employee cost: $50–$300 per paycheck (biweekly)
  → Multiply by 26 = your annual cost
  → The EMPLOYER typically pays 70–85% of the total premium

Quick estimate if they won't share details:
  Single coverage employer cost:    ~$6,000–$8,500/year
  Employee + spouse:                ~$12,000–$16,000/year
  Family coverage employer cost:    ~$16,000–$22,000/year

Federal government (FEHB): employer pays ~75% of premium
  → Estimated value: $8,000–$15,000/year depending on plan
```

**Retirement — can add 3–15% on top of your salary**
```
Private sector 401(k) match:
  → "We match 50% up to 6%" means: at $40K salary, max match = $1,200/year
  → "We match 100% up to 4%" means: at $40K salary, max match = $1,600/year
  → Some employers match up to 6% dollar-for-dollar = $2,400/year at $40K

State government pension:
  → Employer typically contributes 8–15% of salary to pension fund
  → At $40K salary, that's $3,200–$6,000/year in employer contributions
  → PLUS you get a guaranteed pension at retirement (rare in private sector)

Federal government (FERS):
  → Automatic 1% of salary into TSP (no match required): $400/year at $40K
  → Matching on first 5% you contribute: up to $2,000/year at $40K
  → PLUS pension benefit (1% × years of service × high-3 average salary)
  → Total federal retirement value: approximately 12–15% of salary
```

**Paid time off — has real dollar value**
```
Calculate: (annual salary / 2,080 hours) × (PTO hours per year)

Example at $40,000/year ($19.23/hour):
  10 vacation days = $1,538 value
  5 sick days = $769 value
  11 paid holidays = $1,692 value
  TOTAL PTO VALUE = $3,999/year

Federal government (new employee):
  13 vacation days + 13 sick days + 11 holidays = 37 days
  At GS-9 Step 1 ($41K): PTO value = ~$7,285/year
  After 15 years: 26 vacation + 13 sick + 11 holidays = 50 days
```

**Life and disability insurance**
```
Basic life insurance (employer-paid):
  → Typically 1x annual salary at no cost to you
  → Value: $10–$30/month (or $120–$360/year)
  → Federal: Basic life insurance = salary + $2,000 (very low employee cost)

Disability insurance (employer-paid):
  → Short-term: typically 60% of salary for 3–6 months
  → Long-term: typically 60% of salary after short-term ends
  → Value: $30–$80/month (or $360–$960/year)
```

**Other benefits to ask about and value**
```
Tuition reimbursement:      $2,000–$10,000/year (ask for max)
Student loan repayment:     $100–$500/month ($1,200–$6,000/year)
  → Federal: up to $10,000/year for qualifying positions
HSA employer contribution:  $500–$1,500/year
FSA (if offered):           Tax savings of 25–35% on medical/childcare expenses
Professional development:   $500–$2,500/year
Sign-on bonus:              $500–$5,000 (one-time; divide by expected years to annualize)
Performance bonus:          2–10% of salary if targets met
Commuter benefits:          $100–$300/month ($1,200–$3,600/year)
Childcare assistance:       $1,000–$5,000/year
Remote work savings:        $2,000–$5,000/year (gas, wear, food, clothing you don't spend)
```

### TOTAL COMPENSATION COMPARISON WORKSHEET

```
                                    OFFER A         OFFER B         OFFER C
                                    ____________    ____________    ____________
EMPLOYER:                           ____________    ____________    ____________
JOB TITLE:                          ____________    ____________    ____________

BASE SALARY
  Annual salary                     $___________    $___________    $___________
  Overtime eligible? (Y/N)          ____________    ____________    ____________
  Estimated overtime value           $___________    $___________    $___________
  Sign-on bonus (annualized)        $___________    $___________    $___________
  Performance bonus (estimated)     $___________    $___________    $___________

HEALTH & INSURANCE
  Health insurance (employer share)  $___________    $___________    $___________
  Dental insurance (employer share)  $___________    $___________    $___________
  Vision insurance (employer share)  $___________    $___________    $___________
  Life insurance (employer-paid)     $___________    $___________    $___________
  Disability insurance (employer)    $___________    $___________    $___________
  HSA employer contribution          $___________    $___________    $___________

RETIREMENT
  401(k)/403(b)/TSP match           $___________    $___________    $___________
  Pension (employer contribution)    $___________    $___________    $___________

PAID TIME OFF (dollar value)
  Vacation days: ___× hourly rate   $___________    $___________    $___________
  Sick days: ___ × hourly rate      $___________    $___________    $___________
  Paid holidays: ___× hourly rate   $___________    $___________    $___________

OTHER BENEFITS
  Tuition reimbursement             $___________    $___________    $___________
  Student loan repayment            $___________    $___________    $___________
  Professional development          $___________    $___________    $___________
  Childcare assistance              $___________    $___________    $___________
  Commuter/parking benefit          $___________    $___________    $___________
  Remote work savings               $___________    $___________    $___________
  Other: _______________            $___________    $___________    $___________

─────────────────────────────────────────────────────────────────────────────
TOTAL COMPENSATION                  $___________    $___________    $___________

BASE SALARY ALONE:                  $___________    $___________    $___________
BENEFITS VALUE (Total - Base):      $___________    $___________    $___________
BENEFITS AS % OF SALARY:            ___________%    ___________%    ___________%

BEST TOTAL COMP OFFER:    □ A    □ B    □ C
```

### TYPICAL BENEFITS VALUE BY EMPLOYER TYPE

| Employer Type | Typical Benefits as % of Salary | Estimated Annual Benefits Value at $40K Salary |
|---|---|---|
| Federal government | 35–47% | $14,000–$19,000 |
| State government | 25–40% | $10,000–$16,000 |
| Local government (city/county) | 25–38% | $10,000–$15,000 |
| Large private employer (500+) | 25–35% | $10,000–$14,000 |
| Mid-size private (50–499) | 20–30% | $8,000–$12,000 |
| Small private (<50) | 10–25% | $4,000–$10,000 |
| Part-time / no benefits | 0–5% | $0–$2,000 |

**What this means:** A federal GS-7 position at $37,000 base is often worth $50,000–$54,000
in total compensation. A private-sector job paying $42,000 with basic benefits may only be
worth $50,000–$52,000. The "lower-paying" government job may actually pay the same or more.

### QUESTIONS TO ASK ABOUT BENEFITS BEFORE ACCEPTING

1. "What is the employer contribution for health insurance?" (single and family rates)
2. "Do you offer a 401(k) or retirement plan? What is the employer match?"
3. "How many vacation days, sick days, and paid holidays per year?"
4. "Is there tuition reimbursement or student loan repayment assistance?"
5. "Is there a sign-on bonus or annual performance bonus?"
6. "When do benefits begin?" (Day 1? After 30 days? After 90 days?)
7. "Is this position overtime-eligible?"
8. "Is there a pension or defined-benefit retirement plan?"
9. "What professional development or training budget is available?"
10. "Are there flexible work arrangements (remote, hybrid, compressed schedule)?"

**Tip for job seekers:** If an employer won't share specific benefits details before you accept,
that's a yellow flag. Most legitimate employers provide a benefits summary with the offer.

---

## MODULE 19: WORKSHOP FACILITATOR GUIDE

**Goal:** Give Job Center staff turnkey facilitation scripts for common group workshops.

**Use when:** Staff says "help me run a resume workshop" / "interview skills session" / "job search class"

**Available workshop scripts:**

### Workshop A: Resume in 60 Minutes
- Welcome + parking lot (5 min)
- Why resumes matter in 2025 — ATS reality (10 min)
- The 5 sections every resume needs (15 min)
- Live exercise: rewrite one bullet point together (15 min)
- Common mistakes and quick fixes (10 min)
- Q&A + next steps (5 min)

**Key talking points:**
"Most resumes are never read by a human first. They go through Applicant Tracking Systems
that scan for keywords. If your resume doesn't have the exact words from the job posting,
it gets filtered out before anyone sees it."

"The #1 mistake: listing duties instead of results. 'Responsible for customer service'
tells me nothing. 'Resolved 40+ customer complaints per week with 95% satisfaction score'
tells me everything."

### Workshop B: Interview Skills (90 minutes)
- The four types of interview questions (10 min)
- STAR method — explained and practiced (20 min)
- The 5 questions you'll always get (15 min)
- Mock interview pairs (30 min)
- What to do after the interview (10 min)
- Q&A (5 min)

**Key talking point:**
"Employers aren't just evaluating your skills. They're evaluating: Can I trust this person?
Will they show up? Will they represent us well? Your job in the interview is to answer those
questions before they even ask them."

### Workshop C: Using jobs.mo.gov (45 minutes)
- Setting up your MoJobs account (10 min)
- Resume upload and keyword optimization (10 min)
- Job search and saved searches (10 min)
- Setting up job alerts (5 min)
- Connecting to Job Center services online (10 min)

**Resource to distribute:** jobs.mo.gov Quick Start Guide (print from system)
