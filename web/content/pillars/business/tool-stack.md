# Tool Stack Playbook

```mermaid
graph LR
    A[Stage 0: Idea] --> B[Stage 1: Build]
    B --> C[Stage 2: Launch]
    C --> D[Stage 3: Growth]
    D --> E[Stage 4: Scale]
    style A fill:#059669,stroke:#047857,color:#fff
    style B fill:#2563eb,stroke:#1e40af,color:#fff
    style C fill:#7c3aed,stroke:#5b21b6,color:#fff
    style D fill:#d97706,stroke:#b45309,color:#fff
    style E fill:#dc2626,stroke:#b91c1c,color:#fff
```

## Core Rule
**Pick the cheapest tool that does the job today. Upgrade when it breaks, not before.** Tool bloat kills early-stage velocity. Every tool you add is a subscription, a login, and a context switch.

---

## Stage 0: Idea ($0–$50/mo)

You are validating. You need to talk to people and capture learnings. Nothing else.

| Category | Tool | Cost | Notes |
|----------|------|------|-------|
| Communication | Gmail + Google Meet | Free | Don't buy Slack yet. You don't need it. |
| Notes / Docs | Notion (free tier) | Free | Single workspace for everything |
| Design | Canva (free tier) | Free | Landing pages, pitch decks, social |
| Development | GitHub (free tier) | Free | Even for solo founders |
| Landing Page | Carrd | $19/yr | Smoke test pages in under an hour |
| Finance | Wave | Free | Bookkeeping + invoicing. Enough for now. |
| Legal | Stripe Atlas or Clerky | $500 one-time | Formation only. Don't overspend on legal yet. |

**Monthly cost: ~$0–$50**

**Graduate when:** You have a co-founder or first hire and need async coordination.

---

## Stage 1: Build ($50–$200/mo)

You are building an MVP and talking to early users. You need coordination and basic dev infrastructure.

| Category | Tool | Cost | Notes |
|----------|------|------|-------|
| Communication | Slack (free tier) | Free | Up to 90 days of message history |
| Project Management | Linear (free tier) or Notion | Free | Linear for eng. Notion for everything else. |
| Design | Figma (free tier) | Free | Up to 3 Figma files on Starter |
| Development | GitHub + Vercel (free tier) | Free | Vercel for frontend. GitHub Actions for CI. |
| Analytics | PostHog (free tier) | Free | Product analytics. 1M events/mo free. |
| Email | Google Workspace | $7/user/mo | Professional email. Do this before investor outreach. |
| Finance | Wave + Mercury | Free | Mercury for startup banking. No fees. |
| Legal | Clerky | Pay-per-doc | SAFE notes, board consents, equity issuance |

**Monthly cost: ~$50–$200**

**Graduate when:** You have paying customers and need CRM, marketing, or growth tools.

---

## Stage 2: Launch ($200–$800/mo)

You have an MVP live and early customers. You need to acquire, retain, and measure.

| Category | Tool | Cost | Notes |
|----------|------|------|-------|
| Communication | Slack (Pro) | $8/user/mo | Full history. Needed once team hits 5+. |
| Project Management | Linear (Standard) | $8/user/mo | Cycles, roadmaps, triage |
| Design | Figma (Professional) | $15/editor/mo | Unlimited files. Design system. |
| Development | GitHub (Team) + Vercel (Pro) | $4+$20/mo | Branch protections. Preview deployments. |
| Analytics | PostHog or Mixpanel (free tier) | Free | Funnels, retention, feature flags |
| CRM | HubSpot (free tier) or Attio | Free–$30/user/mo | HubSpot free is generous. Attio is cleaner. |
| Finance | QuickBooks Online (Simple Start) | $30/mo | Graduate from Wave when you need reports for investors. |
| Payments | Stripe | 2.9% + $0.30/txn | Standard. Integrate early. |
| Marketing | Mailchimp (free) or Beehiiv | Free–$49/mo | Email list from day one. Beehiiv for newsletters. |
| Legal | DocuSign (Personal) | $10/mo | Contracts, NDAs, advisor agreements |

**Monthly cost: ~$200–$800**

**Graduate when:** You have repeatable revenue, a growing team (10+), and need scale infrastructure.

---

## Stage 3: Growth ($800–$3,000/mo)

You have PMF and are scaling acquisition. You need mature tooling, better analytics, and process.

| Category | Tool | Cost | Notes |
|----------|------|------|-------|
| Communication | Slack (Business+) | $13/user/mo | SSO, compliance, data exports |
| Project Management | Linear (Plus) or Asana (Business) | $8–$25/user/mo | Cross-team workflows. Portfolio views. |
| Design | Figma (Organization) | $45/editor/mo | Branching, design systems, shared libraries |
| Development | GitHub (Enterprise) + AWS or Vercel (Team) | $200–$1,000/mo | Auto-scaling. Multi-environment deploys. |
| Analytics | Mixpanel or PostHog (paid) + GA4 | $0–$500/mo | Mixpanel for product. GA4 for acquisition. |
| CRM | HubSpot (Starter) or Pipedrive | $20–$50/user/mo | Pipeline management. Sequences. Reporting. |
| Finance | QuickBooks Online (Plus) + Stripe | $80/mo + txn fees | Multi-user. Classes. Budgets. Investor-ready reports. |
| Marketing | Mailchimp (Standard) + Buffer | $60–$100/mo | Automation. Segmentation. Social scheduling. |
| Legal | DocuSign (Standard) + outside counsel | $25/mo + retainer | Retainer with startup attorney for $2K–$5K/mo |
| Support | Intercom or Plain | $50–$100/mo | Live chat + help center |

**Monthly cost: ~$800–$3,000**

**Graduate when:** You close Series A, team exceeds 25, and you need enterprise-grade security and compliance.

---

## Stage 4: Scale ($3,000–$15,000+/mo)

You are post-Series A. You need enterprise tooling, SOC 2 readiness, and operational maturity.

| Category | Tool | Cost | Notes |
|----------|------|------|-------|
| Communication | Slack (Enterprise Grid) | $25+/user/mo | Multi-workspace. DLP. eDiscovery. |
| Project Management | Linear (Enterprise) or Jira | $25+/user/mo | Advanced permissions. Audit logs. |
| Design | Figma (Enterprise) | $75/editor/mo | SSO enforcement. Admin controls. |
| Development | GitHub Enterprise + AWS/GCP | $1,000–$10,000/mo | SOC 2 compliant infrastructure. IaC. |
| Analytics | Mixpanel + Amplitude or Snowflake | $500–$5,000/mo | Data warehouse. Custom dashboards. |
| CRM | HubSpot (Professional) or Salesforce | $100–$150/user/mo | Forecasting. Custom objects. API integrations. |
| Finance | QuickBooks + Brex or Ramp | $200+/mo | Expense management. Automated AP. Corporate cards. |
| Marketing | HubSpot Marketing or Marketo | $200–$800/mo | Lifecycle marketing. Lead scoring. Attribution. |
| Legal | Ironclad or DocuSign CLM | $500+/mo | Contract lifecycle management. Templates. |
| HR | Gusto or Rippling | $40+/employee/mo | Payroll. Benefits. Compliance. |
| Security | Vanta or Drata | $500+/mo | SOC 2 automation. Continuous monitoring. |

**Monthly cost: ~$3,000–$15,000+**

---

## Total Cost Summary by Stage

| Stage | Team Size | Monthly Cost | Annual Cost |
|-------|-----------|-------------|-------------|
| 0: Idea | 1–2 | $0–$50 | $0–$600 |
| 1: Build | 2–4 | $50–$200 | $600–$2,400 |
| 2: Launch | 4–10 | $200–$800 | $2,400–$9,600 |
| 3: Growth | 10–25 | $800–$3,000 | $9,600–$36,000 |
| 4: Scale | 25–100+ | $3,000–$15,000+ | $36,000–$180,000+ |

---

## "Graduate When" Triggers

Do not upgrade tools proactively. Upgrade reactively when you hit one of these:

| Trigger | What to Upgrade |
|---------|----------------|
| Slack free history is blocking decisions | Slack Free -> Pro |
| Wave reports can't satisfy investor questions | Wave -> QuickBooks |
| You have >100 leads and lose track of follow-ups | Spreadsheet -> CRM |
| You need branch protections and code review | GitHub Free -> Team |
| Team exceeds 5 and meetings can't keep everyone aligned | Add Linear or Asana |
| Churn is rising and you can't diagnose why | Add Mixpanel or PostHog paid |
| You're sending >1,000 emails/month | Free email -> Mailchimp paid |
| Investor or customer requires SOC 2 | Add Vanta/Drata + upgrade infra |
| You hire employee #1 (not contractor) | Add Gusto or Rippling |

---

## Common Mistakes

1. **Buying enterprise tools at Stage 0.** You don't need Salesforce. You need a spreadsheet.
2. **Tool hopping.** Switching project management tools every quarter destroys continuity. Pick one and commit for 6 months.
3. **Not consolidating.** If you use Notion for docs, use it for project management too. Fewer tools = less friction.
4. **Ignoring free tiers.** Most startup tools have generous free plans. Use them until you genuinely outgrow them.
5. **Skipping analytics.** If you're not measuring, you're guessing. PostHog is free. Install it on day one.
6. **Over-investing in security tooling too early.** SOC 2 matters when customers require it, not before.
7. **No single source of truth.** Pick one place for docs (Notion), one for code (GitHub), one for tasks (Linear). Don't scatter.

---

## Anti-Stack: Tools You Don't Need Yet

| Tool | Skip Until |
|------|-----------|
| Salesforce | 50+ enterprise deals in pipeline |
| Jira | 25+ engineers or enterprise compliance requirement |
| Marketo / Pardot | $5M+ ARR with complex lifecycle marketing |
| Snowflake / Databricks | You've outgrown Mixpanel/PostHog and need a data warehouse |
| Zendesk | 100+ support tickets/week |
| Workday / BambooHR | 50+ employees |

**Disclaimer:** Tool recommendations, pricing, and free tier details are approximate and change frequently. Verify current pricing and features directly with each vendor before purchasing.
