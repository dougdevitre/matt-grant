# Getting Started with Access to Business

## What Is This?

Access to Business is a Claude AI skill that acts as your hands-on startup coach. It doesn't just advise — it builds with you. Every session ends with something shipped.

```mermaid
flowchart LR
    A["Install Skill"] --> B["/start"]
    B --> C["Answer 3 Questions"]
    C --> D["Route to Mode"]
    D --> E["Build"]

    style A fill:#4a90d9,stroke:#2c5f8a,color:#fff
    style B fill:#7b68ee,stroke:#5a4abf,color:#fff
    style C fill:#f5a623,stroke:#c47d10,color:#fff
    style D fill:#e67e22,stroke:#b35e0a,color:#fff
    style E fill:#27ae60,stroke:#1a7a42,color:#fff
```

## Installation

### Option 1: Claude.ai (Recommended)

Add Access to Business to Claude at [claude.ai](https://claude.ai) in a few clicks. It works on the Free, Pro, Max, Team and Enterprise plans.

1. **Download the install file:** [access-to-business.zip](https://github.com/dougdevitre/access-to-business/releases/download/skill-latest/access-to-business.zip)
2. **Don't unzip it.** Claude needs the `.zip` file just as it downloaded.
3. **Turn on code execution.** Skills need it.
   - **Free, Pro or Max:** open **Settings > Capabilities** and turn on **Code execution and file creation**.
   - **Team or Enterprise:** an organization owner opens **Organization settings > Plugins & skills**, clicks the **Policy** tab, and turns on both **Code execution and file creation** and **Skills**.
4. **Upload it:** open **Customize > Skills**, click **+**, then **+ Create skill**, then **Upload a skill**, and choose `access-to-business.zip`.
5. **Turn it on:** in **Customize > Skills**, switch on **access-to-business**. Claude will now use it for any startup question. Start a new conversation with `/start`.

These steps come from Claude's help center: [Use Skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude).
If the link 404s, the first release hasn't been published yet.

### Option 2: Clone the Repo

1. Clone this repository
2. Point your Claude skill directory to the repo
3. The `SKILL.md` file will be automatically detected

## Your First Session

Once installed, just type:

```
/start
```

The skill will ask you three questions:
1. What's your startup or business idea?
2. Customers or funding — which matters more right now?
3. How much time do you have?

Then it routes you to the right mode and gets to work.

## Key Commands

| Command | What It Does |
|---------|-------------|
| `/start` | Full onboarding — identifies your stage and priorities |
| `/help` | See all available commands |
| `/focus [topic]` | Lock into one task until it's done |
| `/sprint [topic]` | 60-minute deep work session with 3-5 micro-tasks |
| `/recover` | Get unstuck with the smallest possible next step |
| `/decide` | Compare options and commit to one |
| `/energy` | Route tasks based on your current energy level |
| `/binder` | Start building your 17-section investor binder |
| `/score` | Rate your investor binder readiness |
| `/pitch` | Draft your pitch (verbal, deck, or one-sheet) |
| `/deck` | Build or review your pitch deck |
| `/metrics` | Review your key startup metrics |
| `/runway` | Calculate your burn rate and runway |
| `/outreach` | Draft sales or investor outreach messages |
| `/validate` | Run customer validation exercises |

## Startup Stages

The skill adapts to your stage:

| Stage | You Say... | The Skill Does... |
|-------|-----------|-------------------|
| **0 — Idea** | "I have an idea" | Helps you validate before building |
| **1 — Pre-Revenue** | "No customers yet" | Gets you your first 10 customers |
| **2 — Early Revenue** | "A few paying customers" | Builds repeatability and GTM |
| **3 — Growth** | "We're scaling" | Systems, capital, and investor readiness |
| **4 — Scaling** | "Series A+" | Efficiency, team, and operational excellence |

## What Can It Build With You?

- Investor binder (17 sections with scoring)
- Pitch scripts, decks, and one-sheets
- Financial models and unit economics
- Sales outreach and pipeline templates
- Legal formation checklists
- Contract templates (SaaS, MSA, NDA, DPA)
- Compliance frameworks (HIPAA, SOC2, GDPR, PCI-DSS)
- Decision frameworks (should I raise, entity type, build vs buy, when to hire)
- Advisor session prep and diagnostic tools
- Integration guides (Stripe, Airtable)
- State-specific resource guides

## Interactive Tools

Four self-contained browser apps ship alongside the skill. Open the HTML file in a browser — no install, no account.

| App | Purpose |
|---|---|
| [`apps/intake-app.html`](apps/intake-app.html) | Structured founder intake assessment |
| [`apps/pitch-timer.html`](apps/pitch-timer.html) | Pitch rehearsal timer with section pacing |
| [`apps/runway-calculator.html`](apps/runway-calculator.html) | Burn rate and runway projection |
| [`apps/unit-economics-calculator.html`](apps/unit-economics-calculator.html) | CAC, LTV, payback, and margin modeling |

The skill will offer these when they match what you're working on — or you can open them directly.

## Contributing

Want to add your state's startup ecosystem? See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Regional Deployment Guide](references/regional/README.md).

## Need Help?

- Open a [GitHub Issue](https://github.com/dougdevitre/access-to-business/issues)
- See the full command reference with `/help`
