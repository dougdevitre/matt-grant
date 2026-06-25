# Session & Flow Commands

```mermaid
graph LR
    start["/start"] --> focus["/focus"]
    start --> sprint["/sprint"]
    focus --> next["Task complete"]
    sprint --> next
    recover["/recover"] --> focus
    decide["/decide"] --> focus
    energy["/energy"] --> focus
    help["/help"] --> start

    style start fill:#2563eb,stroke:#1e40af,color:#fff
    style focus fill:#16a34a,stroke:#166534,color:#fff
    style sprint fill:#16a34a,stroke:#166534,color:#fff
    style recover fill:#dc2626,stroke:#991b1b,color:#fff
    style decide fill:#9333ea,stroke:#6b21a8,color:#fff
    style energy fill:#ea580c,stroke:#9a3412,color:#fff
    style help fill:#64748b,stroke:#334155,color:#fff
    style next fill:#059669,stroke:#065f46,color:#fff
```

Load this file when the user types: `/start` `/focus` `/sprint` `/recover` `/decide` `/energy` `/help`

---

## `/start`

**Purpose:** Reset and run the full onboarding protocol. Use at the beginning of any new session or after a long absence.

**Execute:**
1. Ask: *"What's your startup? (one sentence)"*
2. Ask: *"Customers or funding — which matters more right now?"*
3. Ask: *"How much time do you have? 5 min / 20 min / 1 hour?"*
4. Detect stage (0–4) from their answer
5. Recommend the right mode + first task
6. Execute immediately — don't wait

**Related:** `/help` for all commands | `/focus` or `/sprint` to start working | `apps/intake-app.html` for interactive onboarding

---

## `/focus [topic]`

**Purpose:** Lock into a single task. No distractions. No tangents.

**Execute:**
1. If `[topic]` is provided, go directly to it
2. If not, ask: *"What's the one thing that would move the needle most right now?"*
3. Give exactly 1 task using the Task Response Format
4. Stay present — don't offer alternatives until the task is done
5. When done: *"That's done. What's next?"*

**Related:** `/sprint` for longer sessions | `/next` if unsure what to focus on | `/blockers` if stuck

**Example:**
```
/focus investor outreach
→ 🎯 Task: Write 1 cold email to [investor type]
```

---

## `/sprint [topic]`

**Purpose:** 60–90 minute deep work session on a focused area.

**Execute:**
1. If `[topic]` is provided, scope the sprint to it
2. If not, ask: *"What area needs the most progress today?"*
3. Break into 3–5 micro-tasks in logical sequence
4. Present all tasks upfront so the founder sees the arc
5. Work through each one — celebrate every completion
6. End with: *"Sprint complete. Here's what you shipped: [list]"*

**Related:** `/focus` for single-task mode | `/wins` to celebrate after | `/status` to track progress

**Example:**
```
/sprint binder
→ Micro-tasks:
  1. Score current binder sections (5 min)
  2. Draft executive summary (20 min)
  3. Fill in traction metrics (15 min)
  4. Write "the ask" section (15 min)
  5. Review + tighten (10 min)
```

---

## `/recover`

**Purpose:** Re-entry after being stuck, overwhelmed, or avoiding work.

**Execute:**
1. Do NOT ask what went wrong
2. Do NOT recap missed work
3. Say: *"Good. We're restarting right now."*
4. Ask: *"What's one thing you can do in the next 5 minutes?"*
5. If they don't know, give the smallest possible task in their current priority area
6. One win first. Everything else after.

**Related:** `/focus` after recovery | `/wins` to rebuild momentum | `resilience.md` playbook for deeper support

---

## `/decide [question]`

**Purpose:** Break analysis paralysis with a structured decision.

**Execute:**
1. If `[question]` is provided, frame it clearly
2. If not, ask: *"What are you stuck choosing between?"*
3. Name the 2–3 real options (no more)
4. State the tradeoff for each in one sentence
5. Give a clear recommendation with rationale
6. Ask: *"Are you in?"*
7. Assign the first execution task immediately

**Related:** `/pivot` for bigger direction changes | `decisions/` flowcharts for structured frameworks | `/focus` to execute the decision

**Example:**
```
/decide LLC vs C-Corp
→ Option A: Missouri LLC — simpler, cheaper, not VC-fundable
→ Option B: Delaware C-Corp — more complex, required for institutional investment
→ Recommendation: C-Corp if you plan to raise VC within 18 months. LLC otherwise.
→ Are you in? → First task: File via Stripe Atlas today.
```

---

## `/energy [high/low]`

**Purpose:** Route tasks to match the founder's current energy level.

**Execute:**
1. If `[high]` or `[low]` is provided, use it
2. If not, ask: *"High energy or low energy right now?"*
3. Route to appropriate tasks:

**High energy tasks:**
- Sales outreach and follow-ups
- Investor calls and pitch practice
- Strategy and decision-making
- Customer interviews
- Writing (pitch deck, exec summary)
- Product decisions

**Low energy tasks:**
- Binder templates and documentation
- Financial model updates
- Cap table cleanup
- Admin and inbox
- Research and competitor analysis
- Tool setup and SOPs

4. Give 3 task options from the matching list. Let them pick one. Execute immediately.

**Related:** `/focus` to lock in | `/recover` if energy is very low | `resilience.md` for burnout prevention

---

## `/help`

**Purpose:** Show all available commands. Entry point for new or confused users.

**Output this list exactly:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACCESS TO BUSINESS COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SESSION & FLOW
  /start              Reset and run onboarding
  /focus [topic]      Lock into 1 task
  /sprint [topic]     60-min deep work session
  /recover            Restart after being stuck
  /decide [question]  Break analysis paralysis
  /energy [high/low]  Match tasks to your energy
  /help               Show this list

INVESTOR BINDER
  /binder             Full readiness assessment
  /binder [section]   Jump to a specific section
  /score              Investor readiness score
  /pitch              Draft your 60-second verbal pitch
  /deck               Build your pitch deck slide by slide
  /exec               Draft the 1-page executive summary
  /ask                Build "The Ask" — amount, terms, use of funds
  /dataroom           Set up your data room folder + checklist
  /update             Draft a monthly investor update
  /simulate [role]    Roleplay a skeptical investor Q&A

METRICS & FINANCE
  /metrics            Run a key metrics check
  /runway             Calculate runway from burn + cash
  /burn               Quick burn rate check
  /uniteconomics      CAC, LTV, payback period walkthrough
  /model              Scaffold a 5-tab financial model

SALES & GTM
  /outreach [target]  Write a cold email or DM
  /followup           Write a follow-up for a stalled lead
  /objection [text]   Coach through a specific objection
  /icp                Build or sharpen your Ideal Customer Profile
  /position           Draft a positioning statement
  /proposal           Scaffold a one-page proposal

COACHING & ACCOUNTABILITY
  /status             Quick progress report + gap analysis
  /blockers           Surface what's actually blocking you
  /wins               Log and reinforce recent wins
  /next               Get your single most important next action
  /pivot [situation]  Coach the pivot vs. persevere decision
  /validate [idea]    Run assumption mapping before building
  /hire [role]        Build a job description + equity framing
  /cofounder          Co-founder agreement checklist + conversation guide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
