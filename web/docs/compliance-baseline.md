# Compliance Baseline — Matt Grant for Congress (web)

The legal standard this app is audited against. Matt Grant is a candidate for the **U.S. House of Representatives (MO-02)** in the **August 4, 2026** primary, so this is a **federal** campaign. That single fact controls most of the analysis: the **Federal Election Commission (FEC) is the primary authority**, and federal law **preempts** Missouri's state disclaimer/finance rules for federal campaign communications. Missouri and St. Louis County rules still govern *election administration* matters the site touches (voter information, electioneering), and general consumer/communications law (CAN-SPAM, TCPA, ADA) applies regardless.

> **Educational information, not legal advice.** Verify every rule below against the cited primary source before relying on it, and consult a campaign-finance attorney for guidance specific to the committee's situation. Each item notes its **verified-on** date per the project's staleness convention.

---

## Jurisdiction map

| Concern | Controlling authority | Why |
|---|---|---|
| "Paid for by" disclaimers on site, email, ads, print | **FEC** — 52 U.S.C. § 30120; 11 CFR 110.11 | Federal candidate communications |
| Contribution limits, prohibited sources, donor reporting | **FEC** — 52 U.S.C. § 30116, § 30122; 11 CFR 110 | Federal campaign finance |
| Filing/disclosure schedule | **FEC** — Form 3, quarterly + pre-/post-election | House candidate files with FEC **only**, not the Missouri Ethics Commission |
| State disclaimer law (RSMo 130.031) | **Preempted** for federal comms | 52 U.S.C. § 30143 preempts state law on federal-campaign disclaimers/finance |
| Voter information accuracy, electioneering | **Missouri / St. Louis County** — RSMo ch. 115 | Election administration is state/county |
| Email (commercial-flavored) | **FTC** — CAN-SPAM (15 U.S.C. § 7701 et seq.) | Best practice for campaign email |
| Text messages / robocalls | **FCC** — TCPA (47 U.S.C. § 227) | Autodialed political texts need prior express consent |
| Website accessibility | **DOJ ADA** + state law; WCAG 2.1 AA | Best-practice / risk-mitigation for a private committee |
| Donor data is public | **FEC** publishes itemized contributor data | Donors must be told their info becomes public record |

---

## 1. FEC disclaimers ("Paid for by") — *verified 2026-06-18*

**Required on:** the public campaign website; mass email (more than 500 substantially similar messages); all public communications (mass mail, phone banks of 500+, ads); printed campaign materials (palm cards, mailers, yard signs, flyers); broadcast/digital ads.

**Required wording (authorized committee):** `Paid for by the Matt Grant for Congress Committee.`

**Clear-and-conspicuous standard:**
- Must be readable / not easily overlooked.
- **Internet text:** at least as large as the majority of other text in the communication; reasonable color contrast.
- **Print:** min. 12-pt for pieces up to 24"×36"; contained in a set-apart box with reasonable contrast.
- **Video:** visible ≥ 4 seconds, ≥ 4% of vertical height.

**Exempt items** (disclaimer impractical): buttons, pins, pens, bumper stickers, skywriting, small apparel, and administrative items with no political message (checks, receipts).

- Source: [FEC — Advertising and disclaimers](https://www.fec.gov/help-candidates-and-committees/advertising-and-disclaimers/)
- Source: [11 CFR 110.11](https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11)

## 2. Solicitation / fundraising notices — *verified 2026-06-18*

Any communication that **solicits contributions** (donate page, fundraising email, the WinRed hand-off) should carry:
- The **paid-for-by** disclaimer.
- **Not tax-deductible** notice.
- **Best-efforts** notice: federal law requires the committee to use best efforts to collect and report the **name, mailing address, occupation, and employer** of anyone whose contributions exceed **$200** per cycle.
- **Contributor eligibility / prohibited-source** statement — the on-page solicitation should make clear contributions must be from the donor's **own funds**, by a **U.S. citizen or lawfully admitted permanent resident**, and **not** from a **corporation, labor union, federal contractor, or foreign national**.

- Source: [FEC — Fundraising notices for campaigns](https://www.fec.gov/help-candidates-and-committees/making-disbursements/fundraising-notices-campaigns/)

## 3. Contribution limits & donor reporting — *verify before relying*

- Itemized reporting threshold: **>$200 aggregate per cycle** → name, address, occupation, employer.
- **48-hour notices** for contributions of **$1,000+** received between 20 days and 48 hours before the primary.
- Per-election individual limit is indexed; **verify the current 2025–26 figure** at fec.gov before flagging "over limit" in the app.
- Source: [FEC — dates & deadlines](https://www.fec.gov/help-candidates-and-committees/dates-and-deadlines/)

## 4. Email — CAN-SPAM best practice — *verified 2026-06-18*

CAN-SPAM strictly governs *commercial* email; purely political email is largely outside it, but the committee should follow it as best practice (and FEC mass-email disclaimer rules apply regardless):
- Accurate "From"/"Reply-To"/routing and non-deceptive subject lines.
- A **functioning unsubscribe** mechanism, honored within **10 business days**.
- The sender's **physical postal address**.
- The **paid-for-by** disclaimer on mass (500+) sends.
- Source: [FTC — CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)

## 5. Text messages / calls — TCPA — *verified 2026-06-18*

- Autodialed political **texts/robocalls require prior express consent**; manually sent messages do not.
- Must honor opt-out (**reply STOP**) and identify the sender.
- Source: [FCC — Political campaign robocalls and robotexts rules](https://www.fcc.gov/consumers/guides/political-campaign-robocalls-and-robotexts-rules)

## 6. Voter information & electioneering (MO / St. Louis County) — *verified 2026-06-18*

- Any voting info the site publishes (date, polling place, registration deadline, ID rules, deadlines) must be **accurate and current** — incorrect voter info is the highest-reputational-risk content on the site.
- Electioneering literature/signs are permitted **only on election day** and are **prohibited within 25 feet of a polling place** (RSMo § 115.637).
- Primary date: **August 4, 2026** (consistent across the app).
- Source: [Missouri Revised Statutes ch. 115](https://law.justia.com/codes/missouri/title-ix/chapter-115/)
- Source: [St. Louis County Board of Elections](https://stlouiscountymo.gov/st-louis-county-government/board-of-elections/)

## 7. Website accessibility — WCAG 2.1 AA — *verified 2026-06-18*

DOJ's ADA Title II web rule (WCAG 2.1 AA, deadline Apr 24 2026) binds **state/local governments**, not a private campaign committee — but WCAG 2.1 AA is the practical standard and reduces ADA Title III / state-law exposure. Audit for: keyboard nav + visible focus, alt text, color contrast (4.5:1 text), labeled form fields, captions on video.
- Source: [ADA.gov — web rule first steps](https://www.ada.gov/resources/web-rule-first-steps/)

## 8. Data / privacy — *verified 2026-06-18*

- No omnibus federal privacy law governs campaign data; Missouri has no comprehensive consumer-privacy statute. But:
  - **FEC publishes itemized donor data publicly** (name, city/state/zip, employer, occupation, amount). Donors and supporters should be **told this on the donate flow**.
  - Form-collected PII (contact/volunteer intake) should have a **stated purpose, retention, and opt-out** — the basis for the new Data Policy.
  - If any supporter is a resident of a state with a privacy law (CA/CO/etc.), those rights may attach; a published Data Policy with a contact channel is the mitigations.

---

## How this maps to the app

| Baseline item | Where it lives in the app |
|---|---|
| Site paid-for-by | `components/SiteFooter.tsx`, `lib/site.ts` (`paidForBy`) |
| Email paid-for-by + address + unsubscribe | `lib/email/layout.ts` footer |
| Solicitation notices | `app/(site)/donate/page.tsx` |
| Donor reporting (employer/occupation, limit flag) | `app/dashboard/donors/page.tsx`, `lib/money.ts` |
| FEC filing schedule | `app/dashboard/compliance/page.tsx` |
| PII intake | `app/(site)/contact/actions.ts`, `components/ContactForm.tsx` |
| Staff-only gating (donor/finance/PII) | `middleware.ts`, `lib/auth.ts` |
| Voter info accuracy | `lib/site.ts` (`electionLabel`), GOTV email, map pages |
