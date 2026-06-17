# Donor Limit Checker

A decision tree system for determining whether a prospective donor can legally contribute more to the campaign. Checks donor type, jurisdiction, office sought, aggregate limits, per-election limits, and prohibited source status. Returns a clear yes/no answer with the remaining amount available.

```mermaid
flowchart TD
    A{Who is the donor?} --> B[Individual]
    A --> Z[Other type - check specific rules]

    B --> C{What jurisdiction?}
    C --> D["Federal: $3,300/election"]
    C --> E["State: Check state limits"]

    D & E --> F{"What is their
    aggregate this cycle?"}
    F --> G{Under limit?}
    G -- Yes --> H["Can give $remaining"]
    G -- No --> I["At limit, cannot give more"]

    H --> J{Are they prohibited?}
    I --> END1[STOP - Return contribution]

    J -- "Yes (foreign national,
    federal contractor)" --> K[CANNOT GIVE]
    J -- No --> L[PROCEED - Accept contribution]
```

---

## Quick-Check Decision Tree

Run through these steps in order for every contribution before accepting it.

```
STEP 1: IS THE DONOR A PROHIBITED SOURCE?
  ├─ Foreign national (non-permanent-resident)? → REJECT. No exceptions.
  ├─ Federal contractor (sole proprietor or corp with federal contract)? → REJECT for federal races.
  ├─ National bank? → REJECT for federal races.
  ├─ Corporation? → CHECK JURISDICTION:
  │     Federal races → REJECT (corporations cannot give to federal candidates)
  │     State/local → CHECK STATE LAW (some states allow corporate contributions)
  ├─ Labor union (treasury funds)? → CHECK JURISDICTION:
  │     Federal races → REJECT (union treasury funds cannot go to federal candidates)
  │     State/local → CHECK STATE LAW
  ├─ Anonymous donor (amount > $50)? → REJECT. Must identify donor.
  └─ None of the above → PROCEED TO STEP 2

STEP 2: WHAT TYPE OF DONOR?
  ├─ Individual → Go to STEP 3
  ├─ PAC (connected/nonconnected) → Go to STEP 4
  ├─ Party committee → Go to STEP 5
  ├─ Candidate (self-funding) → Go to STEP 6
  ├─ LLC → Go to STEP 7
  └─ Other entity → CHECK JURISDICTION-SPECIFIC RULES

STEP 3: INDIVIDUAL DONOR — FEDERAL LIMITS (2025-2026 cycle)
  a. Per-election limit to a candidate: $3,300
     - Primary and general are SEPARATE elections
     - Donor can give $3,300 for primary + $3,300 for general = $6,600 total
  b. Calculate: SUM of all prior contributions from this donor 
     to this committee for this specific election
  c. Remaining = $3,300 - sum from (b)
  d. IF remaining > 0 → ACCEPT up to remaining amount
     IF remaining = 0 → REJECT (maxed out for this election)
     IF remaining < 0 → ERROR: over-limit; must refund excess
  e. ALSO CHECK aggregate biennial limit: (NOTE — the aggregate limit
     for contributions to candidates was struck down by McCutcheon v. FEC 
     in 2014. There is currently no federal aggregate limit on individual 
     contributions to candidates. Some states still have aggregate limits.)

STEP 4: PAC DONOR — FEDERAL LIMITS (2025-2026 cycle)
  a. Multicandidate PAC per-election limit: $5,000
     - Primary + general = $10,000 total possible
  b. Non-multicandidate PAC per-election limit: $2,900
  c. Calculate remaining same as Step 3
  d. Verify PAC is registered and has multicandidate status if claiming 
     $5,000 limit (must have been registered 6+ months, received 
     contributions from 50+ donors, contributed to 5+ candidates)

STEP 5: PARTY COMMITTEE DONOR — FEDERAL LIMITS
  a. National party committee per-election: $5,000
  b. State/local party committee per-election: $5,000 (combined)
  c. Party committees may also make coordinated expenditures 
     (separate from contribution limits)

STEP 6: CANDIDATE SELF-FUNDING
  a. Federal: NO LIMIT on personal funds contributed or loaned to 
     own campaign
  b. State: CHECK STATE LAW — some states limit self-funding
  c. Loans from personal funds: must be documented with loan agreement
  d. Family members: treated as regular individuals (subject to 
     individual limits), NOT as self-funding

STEP 7: LLC CONTRIBUTIONS
  a. Federal: LLCs are treated based on their tax status:
     - Single-member LLC (disregarded entity): attributed to the owner 
       as an individual contribution → apply individual limits
     - Multi-member LLC (partnership): attributed to members per their 
       ownership share → each member's share counts against their 
       individual limits
     - LLC electing corporate tax treatment: PROHIBITED at federal level
  b. State: varies significantly — check state law
  c. ALWAYS obtain LLC documentation before accepting
```

---

## Federal Contribution Limits Table (2025-2026 Cycle)

| Donor Type | To Candidate (per election) | To National Party (per year) | To State/Local Party (per year) | To PAC (per year) |
|---|---|---|---|---|
| Individual | $3,300 | $41,300 | $10,000 (combined) | $5,000 |
| Multicandidate PAC | $5,000 | $15,000 | $5,000 (combined) | $5,000 |
| Non-multicandidate PAC | $3,300 | $41,300 | $10,000 (combined) | $5,000 |
| National Party | $5,000 | — | — | $5,000 |
| State/Local Party | $5,000 (combined) | — | — | $5,000 (combined) |

*Note: These limits are indexed for inflation and adjusted in odd-numbered years. Always verify current limits at fec.gov.*

---

## State Limit Quick Reference

State limits vary dramatically. Use this as a starting point and verify current limits with the state election commission.

| State | Individual to Candidate | Corporate Contributions | Union Contributions |
|---|---|---|---|
| California | $5,500/election | Prohibited | Prohibited (treasury) |
| Texas | No limit | No limit | No limit |
| New York | Varies by office ($4,700-$69,700/cycle) | Permitted (limited) | Permitted (limited) |
| Florida | $3,000/election | $3,000/election | $3,000/election |
| Illinois | $6,000-$60,000 (varies by donor/recipient type) | Permitted | Permitted |
| Ohio | $13,847/election | Prohibited | Prohibited (treasury) |
| Pennsylvania | No limit | Permitted (limited) | Permitted (limited) |
| Virginia | No limit | Permitted | Permitted |
| Oregon | No limit | Permitted | Permitted |
| Colorado | $625/election (small dollar state) | Prohibited | Prohibited (treasury) |

---

## Remaining Capacity Calculator

### Input Fields

```
Donor name:          [_________________________]
Donor type:          [ ] Individual  [ ] PAC  [ ] Party  [ ] LLC  [ ] Other
Jurisdiction:        [ ] Federal  [ ] State: ____  [ ] Local: ____
Office sought:       [_________________________]
Election:            [ ] Primary  [ ] General  [ ] Runoff  [ ] Special

Prior contributions this cycle:
  Primary:    $[________]
  General:    $[________]
  Other:      $[________]

Proposed new contribution: $[________]
```

### Output Format

```
DONOR LIMIT CHECK RESULT
========================
Donor: Jane Smith
Type: Individual
Race: US House, IL-13 (Federal)
Election: Primary

Per-election limit:          $3,300.00
Previously contributed:      $1,500.00
Remaining capacity:          $1,800.00
Proposed contribution:       $1,000.00

RESULT: ✓ ACCEPT
Amount accepted:             $1,000.00
New aggregate:               $2,500.00
Remaining after this gift:   $800.00
```

```
DONOR LIMIT CHECK RESULT
========================
Donor: ABC Corporation
Type: Corporation
Race: US Senate (Federal)

RESULT: ✗ REJECT
Reason: Corporations are prohibited from contributing 
to federal candidates (52 USC 30118).
Action: Return the contribution immediately. Do not deposit.
```

```
DONOR LIMIT CHECK RESULT
========================
Donor: Robert Jones
Type: Individual
Race: US House, IL-13 (Federal)
Election: General

Per-election limit:          $3,300.00
Previously contributed:      $3,300.00
Remaining capacity:          $0.00
Proposed contribution:       $500.00

RESULT: ✗ REJECT — MAXED OUT
Donor has reached the maximum for this election.
Options:
  1. Designate to a different election (if donor agrees)
     - Primary remaining: $3,300.00
  2. Return the contribution
  3. Hold for recount/runoff (if applicable)
```

---

## Prohibited Source Checklist

Before accepting any contribution, verify the donor is not a prohibited source.

```
PROHIBITED AT FEDERAL LEVEL:
[ ] Foreign nationals (non-green-card holders, foreign governments, 
    foreign corporations, foreign partnerships)
[ ] Federal government contractors (during period of contract)
[ ] National banks
[ ] Corporations (treasury funds — PAC funds are OK)
[ ] Labor unions (treasury funds — PAC funds are OK)
[ ] Contributions in the name of another (straw donors)
[ ] Anonymous contributions exceeding $50
[ ] Cash contributions exceeding $100

ADDITIONAL STATE PROHIBITIONS (check your state):
[ ] Regulated industries (gaming, tobacco, etc. — varies by state)
[ ] Registered lobbyists (some states restrict during session)
[ ] State contractors (many states prohibit, modeled on pay-to-play laws)
[ ] Minors (some states prohibit; federal allows but must be voluntary 
    and from minor's own funds)
```

---

## Common Edge Cases

### Married Couples
Each spouse has their own individual limit. A joint check from "Bob & Jane Smith" must be attributed. If the check does not specify, split equally or contact the donors for designation. Each spouse can give the full individual maximum.

### Business Partners
A contribution from a partnership is attributed to individual partners according to a written allocation from the partnership, OR equally if no allocation. Each partner's share counts against their individual limit.

### Earmarked Contributions
A contribution given through a conduit (e.g., ActBlue, WinRed) counts against the donor's limit to the ultimate recipient, NOT to the conduit. The conduit's bundling does not count as a contribution.

### Reattribution and Redesignation
If an over-limit contribution is received:
1. **Reattribution:** The excess may be reattributed to another person (typically a spouse) with written authorization within 60 days
2. **Redesignation:** The excess may be redesignated to a different election with written authorization within 60 days
3. **Refund:** If neither reattribution nor redesignation, refund the excess within 60 days

### In-Kind Contributions
In-kind contributions (goods or services donated) count against contribution limits at their fair market value. A donor who provides $1,000 worth of printing services has used $1,000 of their limit.

---

## Best Practices

1. **Check BEFORE accepting.** Run the limit check before depositing any contribution. It is easier to return an undeposited check than to issue a refund.

2. **Maintain a running aggregate per donor.** Update immediately upon receipt. See the contribution-tracker.md for aggregate calculation logic.

3. **When in doubt, hold and verify.** If you cannot confirm a donor's status (e.g., LLC tax treatment, foreign national status), hold the contribution undeposited and investigate within 10 days.

4. **Document everything.** Keep written records of limit checks, especially for edge cases. If you accept a contribution after analysis, note why it was permissible.

5. **Update limits annually.** Federal limits are indexed for inflation. New limits take effect January 1 of odd-numbered years. Subscribe to FEC updates.

6. **Train all fundraising staff.** Everyone who solicits or receives contributions must understand basic limits and prohibited sources. A single illegal contribution can trigger an audit.
