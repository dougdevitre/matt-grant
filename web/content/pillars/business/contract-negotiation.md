# Contract Negotiation Guide

```mermaid
graph LR
    A[Review<br>Contract] --> B[Redline<br>Issues]
    B --> C[Negotiate]
    C --> D{Decision}
    D -->|Concede| E[Accept<br>Terms]
    D -->|Hold| F[Counter]
    F --> C
    E --> G[Execute]
    style A fill:#4a90d9,stroke:#2c5f8a,color:#fff
    style B fill:#f5a623,stroke:#c7841a,color:#fff
    style C fill:#7b68ee,stroke:#5a4cbf,color:#fff
    style D fill:#d94a4a,stroke:#a83232,color:#fff
    style E fill:#5ba85b,stroke:#3d7a3d,color:#fff
    style F fill:#e06090,stroke:#b04870,color:#fff
    style G fill:#5ba85b,stroke:#3d7a3d,color:#fff
```

**For startup founders negotiating customer contracts, vendor agreements, and partnership deals.**

---

## The Negotiation Mindset

**Goal:** A deal that closes, that you can actually perform on, that doesn't expose you to existential risk.

**Not the goal:** Winning every clause. Over-negotiating kills deals and burns goodwill.

**Rules:**
1. Know your walk-away before you start
2. Separate economic terms (price, term, payment) from legal terms (liability, IP, data)
3. Economic terms are the customer's priority — legal terms are your risk management
4. Pick your battles — you cannot win everything
5. Always respond in writing; verbal agreements don't exist in contracts

---

## When a Customer Sends Their Paper (MSA)

Large enterprise customers often send their own Master Services Agreement. This is common and expected. Your job:

**Step 1: Read the whole thing.** Don't just redline the scary clauses.

**Step 2: Flag the material issues** — clauses that could expose you to unlimited liability, require you to do something impossible, or give up ownership of your IP.

**Step 3: Respond with targeted redlines** — don't rewrite the whole document.

**Step 4: Prioritize** — identify your must-haves vs. nice-to-haves before the call.

---

## Key Clauses — What to Fight For

### Limitation of Liability
**What the customer wants:** Uncapped liability on your part.

**Your position:** Cap liability at the fees paid in the prior 12 months (standard SaaS position).

**Why it matters:** Without a cap, one bad incident could put you out of business.

**Typical negotiated outcome:**
- General liability: 12 months of fees
- IP infringement: 2–3x fees or specific cap
- Data breach: Often uncapped or 2–3x fees — this is the hardest one
- Death/personal injury from gross negligence: Typically uncapped (acceptable)

**Your redline:**
```
BEFORE: "Vendor's total liability shall be unlimited."
AFTER: "Vendor's total liability shall not exceed the fees paid by Customer
       in the twelve (12) months preceding the claim."
```

---

### Indemnification
**What the customer wants:** You indemnify them for everything.

**Your position:** Mutual indemnification; your indemnity limited to your IP and data breaches; their indemnity covers their misuse.

**Red flags to push back on:**
- Indemnifying for consequential damages (unlimited exposure)
- Indemnifying for customer's own acts or omissions
- Indemnifying for open source components you didn't write

**Your redline:**
```
BEFORE: "Vendor shall indemnify Customer for any and all claims."
AFTER: "Vendor shall indemnify Customer for third-party claims that the Service,
       as delivered and used in accordance with this Agreement, infringes any
       third-party IP right."
```

---

### IP Ownership
**What the customer wants:** They own anything custom-built for them; sometimes they want to own improvements to your core product.

**Your position:** You own your platform and all improvements. Customer owns their data. Work product ownership for custom dev is negotiable.

**Never give up:**
- Core platform ownership
- Ownership of improvements to your general product
- Right to use learnings from this engagement to improve your product for others

**Negotiable:**
- Custom modules built solely for this customer on a work-for-hire basis
- Customer-specific integrations (can be owned by customer; you retain right to use the pattern/approach)

---

### Data and Security
**What the customer wants:** Specific security certifications, data location requirements, breach liability.

**Your position:**
- Commit to standards you can actually maintain
- Data breach liability: try to cap; at minimum, limit to actual damages
- Audit rights: Offer SOC 2 report in lieu of on-site audits

**Red flags:**
- "Vendor shall be liable for all damages resulting from any breach, including lost profits"
- On-site audit rights with less than 30 days' notice
- Security requirements that exceed your current posture

**Your redline:**
```
BEFORE: "Vendor shall provide Customer with on-site audit rights upon 5 days' notice."
AFTER: "Vendor shall provide Customer with [Company]'s most recent SOC 2 Type II
       report annually. Upon reasonable request with 30 days' notice, [Company] shall
       complete Customer's standard security questionnaire."
```

---

### Auto-Renewal
**What the customer wants:** Easy ability to cancel; no auto-renewal surprise.

**Your position:** Auto-renewal is good for your revenue predictability. Keep it; just make sure the notice period is clear.

**Standard position:** Auto-renewal with [30/60] days' written notice to cancel before renewal.

---

### Termination for Convenience
**What the customer wants:** Right to cancel anytime with short notice.

**Your position:** Keep this out of annual contracts. For monthly contracts, it's standard.

**Annual contract:** "No termination for convenience; termination only for material breach (uncured after 30 days)."

**Monthly contract:** Termination for convenience with 30 days' notice is standard.

---

### Governing Law
**What the customer wants:** Their home state.

**Your position:** Missouri (or Delaware if Delaware C-Corp).

**Typical outcome:** Customer's state usually wins for large enterprise deals. The important clause is actually venue — try to get remote arbitration or your state for disputes.

---

## What You Can Usually Give Without Negotiating

These are low-risk concessions that build goodwill:
- Mutual NDA (vs. one-way)
- Adding specific named users to DPA
- Extending payment terms from net 30 to net 45 (within reason)
- Providing a security questionnaire within 10 business days
- Adding specific DPA language from GDPR boilerplate
- Minor SLA adjustments (99.5% → 99.9% if you actually achieve it)
- Adding a most-favored nation clause on pricing (for large initial commitment)

---

## Red Lines — Never Agree To These

1. **Uncapped liability for any reason** (even data breach — push back hard)
2. **IP ownership of your core platform** or improvements to it
3. **Exclusivity** without significant premium payment
4. **Non-compete** that prevents you from serving other customers in your target market
5. **Unlimited audit rights** with minimal notice
6. **Penalty clauses** for missing SLAs (pay damages, not just credits)
7. **Joint ownership** of any IP created during the engagement
8. **Personal guarantee** from the founder for the company's obligations

---

## Negotiation Tactics

### "This is our standard contract" (Pushback)
Customer says: "We don't negotiate our MSA."

Your response: "I understand — most of it looks straightforward. I have just a few specific items on liability and IP that I need to address. Can we talk through those?"

Most "non-negotiable" contracts have been negotiated. The phrase is a starting position.

---

### Moving Quickly to Close
Use time pressure honestly: "We're trying to close this by [date] to get you into our next onboarding cohort. If I can get the redlines back to you by [date], can you commit to a decision by [date]?"

---

### When They Won't Move
On a clause they won't change: "I understand you can't change the language. Can we add a side letter clarifying that [specific concern]?"

Side letters, addenda, and exhibit clarifications often solve problems that neither party can solve in the main contract body.

---

## Contract Lifecycle Checklist

```
PRE-NEGOTIATION
[ ] Identified deal size and whether it warrants attorney review
[ ] Read the full contract (don't just redline blind)
[ ] Flagged top 5 material issues
[ ] Know your must-haves vs. nice-to-haves

NEGOTIATION
[ ] Responded to customer paper with focused redlines
[ ] Tracked all versions with dates
[ ] No verbal agreements — everything in writing

PRE-SIGNATURE
[ ] Final version reviewed by authorized signatory
[ ] All exhibits and order forms attached and correct
[ ] Governing law and notice address confirmed
[ ] Auto-renewal date noted in calendar
[ ] Filed in contract management system (Notion, Airtable, or DocuSign)

POST-SIGNATURE
[ ] Countersigned copy in your records
[ ] Renewal date on calendar (with 60-day advance reminder)
[ ] Customer added to billing system with correct terms
[ ] Onboarding initiated per agreement start date
```
