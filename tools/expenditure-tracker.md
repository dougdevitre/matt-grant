# Expenditure Tracker

A data management system for tracking all campaign spending, monitoring budget performance, ensuring compliance with reporting requirements, and flagging potential personal use violations.

```mermaid
flowchart TD
    A[Authorize Expense] --> B[Make Payment]
    B --> B1[Check]
    B --> B2[Card]
    B --> B3[Cash]
    B1 & B2 & B3 --> C[Get Receipt]
    C --> D[Enter in System]
    D --> D1[Date]
    D --> D2[Payee]
    D --> D3[Purpose]
    D --> D4[Amount]
    D --> D5[Category]
    D1 & D2 & D3 & D4 & D5 --> E[Update Budget]
    E --> E1[Allocated vs Spent]
    E1 --> F[Calculate Burn Rate]
    F --> G{Over Budget?}
    G -- Yes --> H[Flag for Review]
    G -- No --> I[Reconcile Monthly]
    H --> I
```

---

## CSV Schema

Use this schema as the standard format for tracking every expenditure made by the campaign.

```csv
date,payee,purpose,amount,category,payment_method,check_number,receipt_flag,notes
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `date` | YYYY-MM-DD | Yes | Date the expenditure was made (date of check, charge, or disbursement) |
| `payee` | Text | Yes | Full legal name of the person or entity paid. Use exact name as it appears on invoices. |
| `purpose` | Text | Yes | Brief, specific description of what was purchased. "Consulting" alone is insufficient — use "Digital advertising consulting" or "Fundraising event catering." |
| `amount` | Decimal | Yes | Dollar amount. Always positive. For credits or refunds, use negative with "CREDIT" in notes. |
| `category` | Text | Yes | One of the standard categories listed below |
| `payment_method` | Text | Yes | One of: `check`, `credit_card`, `debit_card`, `wire`, `ach`, `cash`, `in_kind`, `other` |
| `check_number` | Text | Conditional | Required if payment_method is `check`. Leave blank for other methods. |
| `receipt_flag` | Boolean | Yes | `TRUE` if a receipt or invoice is on file; `FALSE` if not yet obtained |
| `notes` | Text | No | Free text: invoice number, contract reference, event name, authorization details |

### Standard Expense Categories

```
PAYROLL             - Staff salaries, wages, payroll taxes, benefits
CONSULTING          - Paid consultants (specify type: media, polling, fundraising, general)
ADVERTISING_DIGITAL - Online ads: Facebook, Google, programmatic, streaming
ADVERTISING_TV      - Television ad production and placement
ADVERTISING_RADIO   - Radio ad production and placement
ADVERTISING_PRINT   - Newspaper, magazine ads
DIRECT_MAIL         - Printing, postage, mail house fees for voter contact mail
PRINTING            - Signs, literature, business cards, bumper stickers
EVENTS              - Venue rental, catering, entertainment, supplies for campaign events
FUNDRAISING         - Costs directly tied to raising money (event costs, platform fees)
TRAVEL              - Candidate and staff travel: airfare, mileage, hotels, meals
OFFICE              - Rent, utilities, internet, phone, furniture, office supplies
TECHNOLOGY          - Software subscriptions, website hosting, CRM, email tools
POLLING             - Survey research, focus groups, modeling
FIELD               - Canvassing supplies, walk lists, clipboards, door hangers
PHONE_BANK          - Autodialers, phone banking platforms, telecom costs
LEGAL_COMPLIANCE    - Attorney fees, compliance software, filing fees, treasurer services
DONATIONS           - Contributions to other candidates or committees
LOAN_REPAYMENT      - Repayment of campaign loans (principal and interest)
REFUNDS             - Contribution refunds returned to donors
MISC                - Anything not fitting above (use sparingly; always explain in notes)
```

### Example CSV Data

```csv
date,payee,purpose,amount,category,payment_method,check_number,receipt_flag,notes
2026-01-10,"Main Street Office LLC","Campaign HQ rent - January",1200.00,OFFICE,check,1001,TRUE,Lease agreement on file
2026-01-12,"Meta Platforms Inc","Facebook ad spend - volunteer recruitment",350.00,ADVERTISING_DIGITAL,credit_card,,TRUE,Campaign card ending 4521
2026-01-15,"Jane Doe Consulting","January general consulting retainer",3000.00,CONSULTING,check,1002,TRUE,Contract dated 12/1/2025
2026-01-18,"USPS","Bulk mail postage - fundraising letter",875.50,DIRECT_MAIL,check,1003,TRUE,Permit #12345
2026-01-20,"Staples","Office supplies: printer paper and toner",89.95,OFFICE,debit_card,,TRUE,Receipt #7789
2026-01-22,"ActBlue","Processing fees for January contributions",156.20,FUNDRAISING,ach,,TRUE,Monthly fee statement
```

---

## Budget Tracking: Allocated vs. Spent

Maintain a budget tracking table that compares planned allocations against actual spending for each category.

### Budget Summary Table

```csv
category,allocated,spent_to_date,committed_unpaid,remaining,pct_spent
PAYROLL,45000.00,12500.00,0.00,32500.00,27.8
CONSULTING,30000.00,9000.00,3000.00,18000.00,30.0
ADVERTISING_DIGITAL,25000.00,3200.00,0.00,21800.00,12.8
ADVERTISING_TV,0.00,0.00,0.00,0.00,0.0
DIRECT_MAIL,15000.00,875.50,0.00,14124.50,5.8
EVENTS,8000.00,0.00,0.00,8000.00,0.0
FUNDRAISING,5000.00,156.20,0.00,4843.80,3.1
TRAVEL,4000.00,0.00,0.00,4000.00,0.0
OFFICE,10000.00,1289.95,1200.00,7510.05,12.9
TECHNOLOGY,3000.00,450.00,0.00,2550.00,15.0
TOTAL,145000.00,27471.65,4200.00,113328.35,18.9
```

### Key Budget Fields

| Field | Definition |
|---|---|
| `allocated` | Total amount budgeted for this category for the full campaign cycle |
| `spent_to_date` | Sum of all expenditures posted in this category |
| `committed_unpaid` | Contracts signed or orders placed but not yet invoiced/paid (obligations) |
| `remaining` | allocated - spent_to_date - committed_unpaid |
| `pct_spent` | (spent_to_date / allocated) * 100 |

---

## Running Balance

Track the campaign's cash position daily.

```
Opening cash on hand (start of period):         $XX,XXX.XX
+ Total contributions received this period:      $XX,XXX.XX
+ Other receipts (interest, refunds received):   $XX,XXX.XX
- Total expenditures this period:                $XX,XXX.XX
- Outstanding checks not yet cleared:            $XX,XXX.XX
= Available cash balance:                        $XX,XXX.XX

Outstanding obligations (unpaid bills/contracts): $XX,XXX.XX
Net position (available cash - obligations):      $XX,XXX.XX
```

### Daily Ledger Format

```csv
date,description,type,amount,running_balance
2026-01-01,Opening balance,BALANCE,0.00,15000.00
2026-01-05,Contribution - Smith,RECEIPT,500.00,15500.00
2026-01-10,Main Street Office LLC - rent,DISBURSEMENT,1200.00,14300.00
2026-01-12,Meta Platforms - Facebook ads,DISBURSEMENT,350.00,13950.00
2026-01-15,Contribution batch - online,RECEIPT,2750.00,16700.00
2026-01-15,Jane Doe Consulting - retainer,DISBURSEMENT,3000.00,13700.00
```

---

## Burn Rate Analysis

Burn rate tells you how long your money will last at current spending levels.

### Calculation

```
Monthly burn rate = Total expenditures last 30 days
Weekly burn rate  = Total expenditures last 7 days
Daily burn rate   = Total expenditures last 30 days / 30

Months of runway  = Current cash on hand / monthly burn rate
Weeks of runway   = Current cash on hand / weekly burn rate

Target: Maintain enough cash to reach Election Day at current burn rate,
        OR have a plan to raise the difference.
```

### Burn Rate Tracking Table

```csv
period_ending,cash_on_hand,monthly_spend,monthly_receipts,net_monthly,runway_months
2026-01-31,13700.00,5671.65,8250.00,2578.35,2.4
2026-02-28,18500.00,7200.00,12000.00,4800.00,2.6
2026-03-31,24100.00,9800.00,15400.00,5600.00,2.5
```

### Burn Rate Alerts

| Condition | Alert Level | Action |
|---|---|---|
| Runway > 6 months | Normal | Continue plan |
| Runway 3-6 months | Watch | Review spending for cuts |
| Runway 1-3 months | Warning | Freeze non-essential spending; accelerate fundraising |
| Runway < 1 month | Critical | Emergency fundraising; cut all non-essential expenses |

---

## Personal Use Flag

Federal law (52 USC 30114) prohibits using campaign funds for personal use. Any expenditure that would exist regardless of the campaign is personal use.

### Personal Use Decision Tree

```
FOR each expenditure:
  1. Would this expense exist even if the candidate were NOT running?
     - YES → PROHIBITED personal use. Do not pay with campaign funds.
     - NO → Permitted campaign expense.
     - MAYBE → Apply the "irrespective test" below.

  2. IRRESPECTIVE TEST: Is this expense one that would exist 
     irrespective of the candidate's campaign?
     - Mortgage/rent on personal residence → PROHIBITED
     - Clothing (non-costume) → PROHIBITED
     - Country club dues → PROHIBITED
     - Vacation travel → PROHIBITED
     - Household food/groceries → PROHIBITED
     - Tuition/school fees → PROHIBITED
     - Health club dues → PROHIBITED

  3. GRAY AREAS (case-by-case, document justification):
     - Mixed-use vehicle → Permitted for campaign portion only; log miles
     - Meals → Permitted if campaign-related (with staff, donors, voters)
     - Cell phone → Permitted if used primarily for campaign; split cost
     - Childcare → Permitted if incurred due to campaign activity (FEC AO 2018-06)
     - Legal fees → Permitted if related to campaign activity; NOT for personal legal
```

### Flag Column in Expenditure Tracker

Add a `personal_use_flag` column to flag questionable expenditures:

| Flag Value | Meaning |
|---|---|
| `CLEAR` | Clearly a campaign expense |
| `REVIEW` | Could be questioned; document justification |
| `PROHIBITED` | Cannot be paid with campaign funds |
| `SPLIT` | Mixed use; only campaign portion should be charged |

---

## Export Formats

### FEC Schedule B (Itemized Disbursements)

Federal campaigns must itemize all expenditures. Export mapping:

| Tracker Field | FEC Field | Notes |
|---|---|---|
| date | expenditure_date | Format YYYYMMDD |
| payee | payee_name | Full legal name |
| purpose | expenditure_purpose | Must be specific and descriptive |
| amount | expenditure_amount | Decimal, two places |
| category | disbursement_category | Maps to FEC category codes |

### FEC Purpose Description Requirements

The FEC requires specific purpose descriptions. These are insufficient:

- "Expenses" / "Miscellaneous" / "Supplies" / "Services" / "Consulting"

These are acceptable:

- "Facebook digital advertising" / "Office supplies: printer paper" / "Media consulting: TV ad production" / "Fundraising event catering for 3/15 dinner"

### General Export Checklist

```
[ ] All expenditures in the reporting period are entered
[ ] Every expenditure has a specific, descriptive purpose
[ ] Receipt or invoice is on file for every expenditure
[ ] Check numbers are recorded for all check payments
[ ] Credit card charges match the monthly statement
[ ] Personal use review is complete — no prohibited expenses
[ ] Outstanding obligations (unpaid bills) are listed
[ ] Payroll taxes and withholding are properly recorded
[ ] In-kind contributions received are also recorded as expenditures
[ ] Refunds to donors are recorded with matching contribution references
[ ] Vendor addresses are on file for all payees (required for itemization)
```

---

## Best Practices

1. **Record expenditures immediately.** Enter the expense the day payment is made. Do not wait for the check to clear or the credit card statement to arrive.

2. **Keep every receipt.** Photograph receipts the same day. Paper fades. Store digital copies organized by date and vendor.

3. **Be specific in purpose descriptions.** "Consulting" will get a Request for Additional Information from the FEC. "General strategy consulting per contract dated 1/1/2026" is better.

4. **Review for personal use monthly.** Do not wait until an audit. Have the treasurer review every expenditure against the personal use rules each month.

5. **Track obligations.** A signed contract is a debt even before the invoice arrives. Report all outstanding obligations on your filing.

6. **Reconcile against bank and credit card statements.** Every charge on the bank statement must appear in your tracker. Every tracker entry must appear on a statement.

7. **Separate campaign and personal finances completely.** Use a dedicated campaign bank account and campaign credit card. Never mix funds.

8. **Retain records for 3 years** after the filing date of the report that covers the transaction (federal requirement).
