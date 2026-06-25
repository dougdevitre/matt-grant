# Automation: Admin, Audit & Strategy

> **Prerequisite:** Start with Sales, Operations, and Marketing automation in `automation.md` first.

---

## Category 4: Admin Automation

### Receipt Capture and Categorization

**Manual process:** You buy something with the company card. The receipt sits in your email. At month-end, you spend 2 hours hunting through email for receipts and categorizing them for your bookkeeper.

**Automated version:** Forward receipts to an auto-capture email address. They get parsed, categorized, and matched to transactions.

| Detail | Value |
|--------|-------|
| Tools | Dext (Receipt Bank), Expensify, or QuickBooks receipt capture |
| Setup time | 30 minutes |
| Time saved | 2-3 hours/month |

**Setup steps:**
```
1. Sign up for Dext or enable QuickBooks receipt capture.
2. Set up the forwarding email (e.g., receipts@dext.cc).
3. Create an email rule: any email with "receipt" or "invoice" auto-forwards.
4. Set expense categories (SaaS, Travel, Marketing, Office, etc.).
5. Review and approve weekly (10 minutes).
```

### Contract Signature Workflows

**Manual process:** You create a contract in Google Docs. You download it as a PDF. You email it. The client prints it, signs it, scans it, and emails it back. This takes 3-7 days and sometimes the contract just disappears.

**Automated version:** Upload your contract template with signature fields. Send via e-signature tool. Track status. Auto-file when complete.

| Detail | Value |
|--------|-------|
| Tools | DocuSign (free tier), PandaDoc, or HelloSign |
| Setup time | 1 hour |
| Time saved | 1-2 hours/week |

**Workflow:**
```
1. Save contract templates with [PLACEHOLDER] fields in your e-sign tool.
2. When ready: select template -> fill fields -> send for signature.
3. Signer gets email -> signs in browser -> both parties get a copy.
4. Zapier: signed contract -> auto-upload to Google Drive folder.
5. Zapier: signed contract -> update CRM deal stage to "Contract Signed."
```

### Meeting Scheduling

**Manual process:** "What times work for you?" "How about Tuesday at 2?" "Actually, Wednesday is better." "OK, 3pm?" Four emails later you have a meeting. You just lost a day.

**Automated version:** Share a booking link. The prospect picks a time. It auto-appears on your calendar with a video link.

| Detail | Value |
|--------|-------|
| Tools | Calendly (free), Cal.com (open source), or SavvyCal |
| Setup time | 20 minutes |
| Time saved | 2-3 hours/week |

**Calendly rules for founders:**
```
1. Available hours: 1:00 PM - 4:00 PM only (protect mornings).
2. Buffer between meetings: 10 minutes.
3. Max meetings per day: 3.
4. Minimum notice: 24 hours (no same-day bookings).
5. Meeting types:
   - "Quick Chat" — 15 min
   - "Demo / Sales Call" — 25 min
   - "Deep Dive" — 50 min (requires approval)
6. Auto-include Google Meet / Zoom link.
7. Auto-send reminder 1 hour before.
```

---

## Quick Wins: Set Up in Under 30 Minutes

These are the automations that give you immediate time back with minimal setup.

| # | Automation | Tool | Setup Time | Weekly Time Saved |
|---|-----------|------|------------|-------------------|
| 1 | Meeting scheduling link | Calendly / Cal.com | 15 min | 2-3 hrs |
| 2 | Receipt auto-forwarding | Dext / QuickBooks | 15 min | 30 min |
| 3 | Social media batch scheduling | Buffer / Typefully | 20 min | 2-3 hrs |
| 4 | Email follow-up sequence (3 emails) | HubSpot / Mailshake | 30 min | 3-5 hrs |
| 5 | Contract signature workflow | DocuSign / PandaDoc | 30 min | 1-2 hrs |
| 6 | Slack channel for form submissions | Zapier + Typeform | 20 min | 1 hr |
| 7 | Auto-calendar reminders for weekly tasks | Google Calendar | 10 min | 30 min |

**Start with #1 and #4.** Scheduling and follow-ups are the two biggest time drains for early-stage founders.

---

## Automation Stack by Stage

Not everything needs to be automated on day one. Build up as you grow.

### Stage 0: Pre-Revenue (Solo Founder)
- Calendly for scheduling
- Email templates (Gmail canned responses)
- Receipt forwarding
- **Total cost:** $0

### Stage 1: Early Revenue ($1K-$10K MRR)
- CRM with email integration (HubSpot free)
- Follow-up email sequences
- Invoice auto-generation
- Social media scheduling
- **Total cost:** $0-$50/month

### Stage 2: Growing ($10K-$50K MRR)
- Full onboarding sequences
- Lead scoring
- Recurring report automation
- Contract signature workflows
- Review/testimonial collection
- **Total cost:** $50-$200/month

### Stage 3: Scaling ($50K+ MRR)
- Custom Zapier/Make workflows across all tools
- Auto-CRM updates from all touchpoints
- Marketing automation platform
- Dedicated ops tooling
- **Total cost:** $200-$500/month

---

## The Automation Audit

Run this monthly. List every task you did manually more than twice last week.

```
AUTOMATION AUDIT — Month of [DATE]

Task: [What you did manually]
Frequency: [How often per week]
Time per instance: [Minutes]
Total time wasted: [Weekly hours]
Can it be automated? [Yes / No / Partially]
Tool: [What would automate it]
Priority: [High / Medium / Low]

DECISION:
  High priority + easy setup -> Do it this week.
  High priority + hard setup -> Schedule for next sprint.
  Low priority -> Ignore until it becomes high priority.
```

---

## Common Traps

| Trap | Fix |
|------|-----|
| Automating before you have a process | Document the manual process first. Then automate. |
| Spending 8 hours automating a 10-minute task | Only automate tasks you do 3+ times per week. |
| Too many tools, nothing connected | Pick one hub (Zapier or Make) and route everything through it. |
| Set it and forget it | Audit automations monthly. Broken workflows waste more time than manual work. |
| Over-automating customer communication | Automate the first touch. Personalize everything after the reply. |
| Not having a "kill switch" | Every automation should have a way to pause it instantly. |

---

*This playbook covers workflows, not strategy. Automation handles the repeatable so you can focus on the unrepeatable: customer relationships, product decisions, and creative problem-solving. Start with one Quick Win this week. Add one more next week. In a month, you will have 10+ hours back.*
