# Donation Intake

A step-by-step workflow for processing every contribution your campaign receives. Proper intake procedures protect your campaign from compliance violations, ensure accurate reporting, and maintain donor relationships. Every person who handles contributions should be trained on this process.

```mermaid
flowchart TD
    A["Receive Donation"] --> B{"Donor Type?"}
    B -->|Individual| C{"Within\ncontribution\nlimit?"}
    C -->|Yes| Accept["Accept, record,\nand deposit"]
    C -->|No| Return["Return excess\nto donor"]
    B -->|Corporation| D{"Federal race?"}
    D -->|Yes| Prohib1["PROHIBITED"]
    D -->|No / State race| E{"Check state\nrules"}
    E --> F["Follow jurisdiction\nguidance"]
    B -->|Foreign National| Prohib2["PROHIBITED"]
    B -->|Cash over $100| Prohib3["PROHIBITED\n(federal)"]
```

---

> **EDUCATIONAL DISCLAIMER:** Contribution limits, prohibited sources, reporting thresholds, and required donor information vary by jurisdiction. Federal campaigns are governed by FEC regulations; state and local campaigns have their own rules. Always verify the specific requirements for your race. This guide provides general best practices and does not constitute legal advice.

---

## Standard Donation Processing Workflow

### Step 1: Receive the Contribution

Contributions arrive in multiple forms. Process each within 24 hours of receipt.

- [ ] Record the date of receipt (the date the campaign received or gained control of the funds)
- [ ] Identify the contribution type: check, cash, online/credit card, money order, in-kind
- [ ] If cash, count in the presence of a witness and document the amount
- [ ] If check, photocopy or scan the front and back before depositing

### Step 2: Verify Donor Eligibility

Before depositing or acknowledging any contribution, verify the donor is eligible to give.

- [ ] Confirm the donor is a U.S. citizen or lawful permanent resident (for federal races)
- [ ] Confirm the donor is not a prohibited source (foreign national, federal contractor, corporation in jurisdictions that prohibit corporate contributions)
- [ ] Confirm the contribution is from the donor's own funds (not acting as a conduit for another person)
- [ ] For PAC contributions, verify the PAC is registered and active

### Step 3: Check Contribution Limits

- [ ] Look up the donor in your records to determine their cumulative contribution total
- [ ] Verify that this contribution, combined with prior contributions, does not exceed the per-election limit
- [ ] If the contribution would exceed the limit, see "Over-Limit Contributions" below
- [ ] For primary and general elections: track limits separately if your jurisdiction counts them as separate elections

### Step 4: Collect Required Donor Information

At minimum, collect the following for every contribution:

| Field | Required For | Notes |
|---|---|---|
| Full legal name | All contributions | As it appears on ID; not nicknames |
| Mailing address | All contributions | Full street address, city, state, zip |
| Date of contribution | All contributions | Date received by the campaign |
| Amount | All contributions | Exact amount |
| Contribution type | All contributions | Check, cash, card, in-kind, etc. |
| Employer | Contributions above threshold | Federal: $200+; varies by state |
| Occupation | Contributions above threshold | Federal: $200+; varies by state |
| Check number / transaction ID | All non-cash contributions | For tracking and reconciliation |

- [ ] If employer or occupation is missing, send a follow-up request within 30 days
- [ ] Keep records of all attempts to obtain missing information (best-efforts documentation)

### Step 5: Issue a Receipt

- [ ] Prepare a receipt for every contribution (even if not legally required -- it is best practice)
- [ ] Include: donor name, amount, date, committee name, and a note that contributions are not tax-deductible (political contributions are generally not deductible)
- [ ] Send the receipt within 48 hours of receiving the contribution
- [ ] For online contributions, ensure your platform sends automated receipts

### Step 6: Deposit the Contribution

- [ ] Deposit all contributions into the campaign bank account
- [ ] Deposit within 10 days of receipt (sooner is better; some jurisdictions require faster deposits)
- [ ] Record the deposit date and bank transaction reference
- [ ] Never deposit contributions into a personal account

### Step 7: Enter Into Tracking System

- [ ] Enter the contribution into your campaign finance tracking system
- [ ] Verify all fields are complete and accurate
- [ ] Update the donor's cumulative contribution total
- [ ] Flag any contributions that require follow-up (missing info, near-limit donors)
- [ ] File the physical receipt, check copy, or transaction record

---

## Edge Cases and Special Situations

### LLC and Business Entity Contributions

> **EDUCATIONAL DISCLAIMER:** Rules on LLC and business entity contributions vary dramatically by jurisdiction. Some jurisdictions attribute LLC contributions to the individual members; others treat LLCs as corporations (prohibited in some jurisdictions). Verify your jurisdiction's rules.

- [ ] Determine if your jurisdiction allows contributions from LLCs or business entities
- [ ] If allowed, determine if the contribution is attributed to the entity or its members
- [ ] If attributed to members, obtain the members' names and ownership percentages
- [ ] Apply contribution limits to each attributed member separately
- [ ] Record the entity name AND the individual members if attribution is required

### Joint Account Contributions

When a check comes from a joint bank account:

- [ ] The contribution is attributed to the account holder who signed the check
- [ ] If both names are on the check's signature line, split equally unless otherwise indicated
- [ ] If one spouse writes "Mr. and Mrs." on the memo line, treat as two separate contributions (each at half the amount) only if both individuals are identified
- [ ] Collect required information for each individual contributor
- [ ] Each individual's share counts against their individual contribution limit

### In-Kind Contributions

An in-kind contribution is a donation of goods, services, or anything of value other than money.

- [ ] Determine the fair market value (FMV) of the goods or services
- [ ] FMV = what the goods or services would cost if purchased at the going commercial rate
- [ ] Record the in-kind contribution at its FMV as both a contribution received and an expenditure made
- [ ] The FMV counts against the donor's contribution limit
- [ ] Common in-kind contributions: venue space, catering, printing, professional services, office supplies
- [ ] Obtain a written description from the donor of what was provided and its estimated value
- [ ] Volunteer time is NOT an in-kind contribution (volunteering is exempt), but paid professional services donated are

### Over-Limit Contributions

If a contribution would cause a donor to exceed the legal limit:

- [ ] Do NOT deposit the excess portion
- [ ] Calculate the amount that exceeds the limit
- [ ] Contact the donor within 48 hours to explain the situation
- [ ] Offer options: refund the excess, redesignate to a different election (if applicable), or return the entire contribution
- [ ] Issue a refund check from the campaign account for the excess amount within the legally required timeframe (typically 30-60 days)
- [ ] Document the entire process: original contribution, communication with donor, refund issued
- [ ] If you deposited the full amount before discovering the excess, issue the refund promptly and document the error

### Returned / Bounced Contributions

- [ ] If a check bounces or a credit card charge is reversed, update your records immediately
- [ ] Remove the contribution from your totals
- [ ] Contact the donor to resolve the issue (offer alternative payment methods)
- [ ] Document the returned contribution and the reason
- [ ] If the contribution was already reported on a filing, adjust it on the next report

### Anonymous Contributions

- [ ] Federal campaigns: anonymous contributions over $50 are prohibited
- [ ] State/local: check your jurisdiction's threshold for anonymous contributions
- [ ] If an anonymous contribution exceeds the threshold, you cannot keep it
- [ ] Options: return to donor (if identifiable) or donate to charity / the U.S. Treasury
- [ ] Cash contributions are particularly risky -- many jurisdictions prohibit cash contributions over a low threshold (e.g., $100)

### Contributions via Intermediaries / Bundlers

- [ ] A bundler collects contributions from multiple donors and delivers them together
- [ ] Each individual contribution must be attributed to the actual donor, not the bundler
- [ ] Collect full donor information for each individual contribution in the bundle
- [ ] Some jurisdictions require disclosure of the bundler's identity
- [ ] Never accept a single large check from a bundler that is meant to represent multiple donors -- each donor must write their own check or make their own online contribution

---

## Contribution Processing Checklist (Quick Reference)

For every contribution, verify:

- [ ] Donor is eligible to contribute
- [ ] Amount is within legal limits (including cumulative total)
- [ ] All required information is collected (name, address, employer, occupation)
- [ ] Receipt is issued
- [ ] Contribution is deposited into the campaign bank account
- [ ] Contribution is entered into the tracking system
- [ ] Documentation is filed

When in doubt about any contribution, do not deposit it. Consult your treasurer, and if necessary, a campaign finance attorney. It is always safer to return a questionable contribution than to accept one that creates a compliance problem.
