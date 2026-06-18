# Compliance Audit — Matt Grant for Congress (web app)

**Date:** 2026-06-18 · **Scope:** every public page, dashboard (member) page, feature, email template, and on-site copy in `web/`, audited against [`compliance-baseline.md`](./compliance-baseline.md) (FEC primary; Missouri / St. Louis County for election administration; CAN-SPAM, TCPA, ADA where applicable).

> Educational information, not legal advice. Confirm each finding with a campaign-finance attorney before filing or publishing.

## Remediation log

| Date | Finding(s) | What changed |
|---|---|---|
| 2026-06-18 | X-1, X-2, X-3, P-4 | Published `/data-policy`, `/transparency`, `/public-trust` pages (shared `components/PolicyPage.tsx`); added a "Legal & transparency" footer column (`lib/site.ts` `LEGAL`, `SiteFooter.tsx`); added routes to `sitemap.ts`. |
| 2026-06-18 | P-1, P-2 | Donate page now carries the contributor-eligibility / prohibited-source statement and discloses that >$200 contributions are reported to and published by the FEC, linked to the Data Policy. |
| 2026-06-18 | P-3 | Contact form now shows a data-use notice (purpose, never-sold), update + STOP consent language, and a Data Policy link. |
| 2026-06-18 | E-1 (partial) | Hardened `lib/email/send.ts`: per-recipient token substitution + a guard that **refuses to send** if any `{{merge_token}}` remains unfilled (prevents a dead unsubscribe link). **Still open:** no broadcast/list send path or opt-out suppression store exists yet — when one is built, it must pass real `unsubscribe`/`preferences` URLs via `tokens` and record + honor opt-outs. No live broken-unsubscribe today because no mass-send path is wired. |
| 2026-06-18 | D-2 | Verified the 2025–26 FEC individual limit ($3,500/election) against fec.gov and added a verified-on stamp + re-verify note in `lib/money.ts`. |
| 2026-06-18 | P-5 | Wired the action-plan "confirm you're registered" step to the official MO SOS voter lookup; consolidated that URL into `lib/site.ts` (`VOTER_LOOKUP`, now shared by `AskMatt`); fixed `AgendaBuilder` to actually render `ActionItem.href` (links were populated but never shown). App already defers voter info to official SOS/county-GIS sources — no restated deadlines/ID rules. |
| 2026-06-18 | P-6 | Verified (no change): all print generators embed the "Paid for by" line; PrintStudio collects consent + links Walgreens Terms/Privacy; Walgreens data handoff now documented in the Data Policy; orderable yard-sign uses the now-disclaimered `api/graphics`. Pass. |
| 2026-06-18 | P-8 | Added the "Paid for by" disclaimer to the dashboard Studio graphics generator (`app/api/graphics/route.tsx`) — those images are downloaded and posted as standalone public communications. (The script-based `generate-social-graphics.mjs` already carried it.) Visually QA'd via dev server across `ig_square`, `x_header`, and `web_banner` (navy + gold themes): disclaimer renders fully and legibly, no clipping. Wide formats use a smaller disclaimer font so the line clears the short bottom margin. |

*Remaining open items: E-1 suppression store (above), P-5 voter-info sourcing, P-6 print data flow, P-7 accessibility pass, P-8 disclaimer on embedded/OG surfaces, D-1 data-retention posture, D-2 FEC limit verified-on stamp, X-5 verified-on discipline.*

## How to read this

Severity reflects legal + reputational risk for a **federal** campaign:
- 🔴 **High** — legal exposure or voter-harm risk; fix before/at launch.
- 🟠 **Medium** — likely-required or strong best practice; fix soon.
- 🟡 **Low** — polish, defensive documentation, or verify-and-confirm.
- 🟢 **Pass** — already compliant; noted so it isn't regressed.

---

## Summary scoreboard

| Surface | 🔴 | 🟠 | 🟡 | 🟢 |
|---|---|---|---|---|
| Public site | 1 | 4 | 3 | 4 |
| Dashboard (member) | 0 | 2 | 2 | 3 |
| Email | 0 | 2 | 1 | 2 |
| Cross-cutting (policy/data) | 1 | 3 | 1 | — |

**Top priorities:** (1) publish the **Data / Transparency / Public-Trust** policies and link them site-wide; (2) add **contributor-eligibility** language to the donate solicitation; (3) add a **data-use notice + consent** to the contact form; (4) verify the email send pipeline actually substitutes `{{unsubscribe_url}}`.

---

## 1. Public site

### 🔴 P-1 — Donate page omits contributor-eligibility / prohibited-source statement
**Where:** [`app/(site)/donate/page.tsx`](../app/(site)/donate/page.tsx)
The page solicits contributions and correctly states *not tax-deductible* + *best-efforts $200* + paid-for-by. It does **not** state who is legally allowed to give. FEC solicitation guidance expects the prohibited-source/eligibility notice on the solicitation itself (own funds; U.S. citizen or lawful permanent resident; not a corporation, union, federal contractor, or foreign national). WinRed collects this downstream, but the on-site solicitation is itself a solicitation.
**Fix:** add an eligibility sentence to the existing fine-print block. Suggested copy:
> By proceeding you confirm this contribution is made from your own funds, on a personal card, and that you are a U.S. citizen or lawfully admitted permanent resident. Federal law prohibits contributions from corporations, labor unions, federal contractors, and foreign nationals.

### 🟠 P-2 — Donate page doesn't disclose that itemized donor data becomes public
**Where:** `app/(site)/donate/page.tsx`
The best-efforts line explains *collection* but not that the FEC **publishes** name/city/state/zip/employer/occupation/amount for >$200 donors. Disclosing this is honest and reduces "I didn't know" complaints.
**Fix:** one line linking to the new Data Policy: *"Contributions over $200 are reported to and published by the FEC. See our Data Policy."*

### 🟠 P-3 — Contact form collects PII with no data-use notice or consent
**Where:** [`components/ContactForm.tsx`](../components/ContactForm.tsx), [`app/(site)/contact/actions.ts`](../app/(site)/contact/actions.ts)
Collects name, email, phone, city, interests, free-text message → stored in DynamoDB + emailed. No statement of purpose, retention, or opt-out, and no link to a privacy policy. If a "Phone" + "Make calls/Text" interest is later used to **text** supporters, TCPA consent should be captured here.
**Fix:** add a short notice under the submit button linking to the Data Policy, e.g. *"We'll use your info only to follow up about the campaign. We never sell it. See our Data Policy. By submitting you agree to receive campaign updates; reply STOP to any text to opt out."*

### 🟠 P-4 — No Privacy/Data, Transparency, or Public-Trust pages exist; footer has no legal links
**Where:** [`components/SiteFooter.tsx`](../components/SiteFooter.tsx), `app/(site)/`
No `/privacy`, `/data-policy`, `/transparency`, or `/public-trust` routes. Footer links only to nav + staff sign-in. A published privacy/data policy is the baseline mitigation for collecting PII online.
**Fix:** add the three policy pages (drafts in [`docs/policies/`](./policies/)) and a "Legal & transparency" column in the footer.

### 🟠 P-5 — Voter-information accuracy needs a single sourced, dated home
**Where:** `lib/site.ts` (`electionLabel`), GOTV email, `app/dashboard/map`, any "make a plan to vote" copy
The Aug 4 2026 date is consistent (good). But polling-place / registration-deadline / ID info, if surfaced anywhere public, is the highest voter-harm risk and should be sourced to the St. Louis County Board of Elections + MO SOS with a "verified on" date, or deep-linked rather than restated.
**Fix:** route voter "how to vote" CTAs to official `.gov` sources; if restated, add a dated source line and a verification owner.

### 🟡 P-6 — Print/Walgreens order flow relies on a third party's privacy policy
**Where:** [`components/PrintStudio.tsx`](../components/PrintStudio.tsx) (links Walgreens privacy policy; collects T&C consent)
Consent + third-party policy link is good. Confirm the campaign's own Data Policy covers data handed to Walgreens, and that printed output carries the paid-for-by line (the studio copy references it — verify rendered PDFs include it).

### 🟡 P-7 — Accessibility pass not yet evidenced
**Where:** site-wide
Spot-checks look reasonable (form `<label>`s, `role="status"`, `aria-hidden` on decorative images, alt text). No evidence of a full WCAG 2.1 AA pass (contrast ratios, keyboard focus order, video captions on `HeroVideo`).
**Fix:** run axe/Lighthouse + a manual keyboard pass; caption hero video; document results.

### 🟡 P-8 — "Paid for by" present in footer but verify it renders on standalone/og and embedded surfaces
**Where:** `components/SiteFooter.tsx`
Footer disclaimer is global (good), but confirm it appears on any page that might render without the footer (e.g., embeds, the print page output, social/OG cards generated by `app/api/graphics`).

**🟢 Passing on public site:** global paid-for-by disclaimer (footer + `lib/site.ts`); donate page tax/best-efforts notices; no invented polls/endorsements/stats found in `lib/issues.ts` or homepage copy; faithful platform language per `candidate/platform.md`.

---

## 2. Dashboard (member / staff view)

### 🟠 D-1 — Donor PII protected by auth, but no data-retention / access-log posture documented
**Where:** [`app/dashboard/donors/page.tsx`](../app/dashboard/donors/page.tsx), `lib/queries.ts`, `lib/db.ts`
Donor names, emails, employers, amounts are shown. Gating is solid (see D-PASS), but there's no documented retention schedule, access log, or "who can see this" policy. For donor data this is a governance gap more than a legal one.
**Fix:** document in the Data Policy who has dashboard access (the `DASHBOARD_ALLOWLIST`), how long donor records are kept, and the deletion process.

### 🟠 D-2 — "Over limit" flag hardcodes a per-election figure that must track FEC indexing
**Where:** `app/dashboard/donors/page.tsx`, `lib/money.ts` (`FEC_INDIVIDUAL_PER_ELECTION_CENTS`)
The page already says "verify against current FEC guidance" (good), but a stale constant can mislabel a legal contribution as "over limit" or miss a real over-limit. 
**Fix:** add the verified-on date next to the constant in `lib/money.ts` and a checklist item to confirm each cycle.

### 🟡 D-3 — Finance "cash on hand" is illustrative — disclaimer present, keep it
**Where:** `app/dashboard/finance/page.tsx`
Already states "illustrative, not a filed FEC figure… reconcile against bank statements and FEC Form 3." 🟢 well-handled — flagged only so the disclaimer isn't removed in a refactor.

### 🟡 D-4 — Compliance filing dates must be verified each cycle
**Where:** `app/dashboard/compliance/page.tsx`
Correctly states House candidates file with the **FEC, not the MEC**, links fec.gov, and flags 48-hour notices. Dates are hardcoded with a "must be verified" note. 🟢 strong. Keep the verify-before-filing language; consider a verified-on stamp.

**🟢 Passing on dashboard:** fail-closed middleware (prod with no Clerk → redirect, APIs → 401) in `middleware.ts`; email allowlist belt-and-suspenders in `lib/auth.ts`; FEC employer/occupation capture on the donor form; "educational, not legal advice" disclaimers across finance/donors/compliance.

---

## 3. Email

### 🟠 E-1 — Unsubscribe/preferences depend on the send pipeline substituting tokens
**Where:** [`lib/email/templates.ts`](../lib/email/templates.ts) (`{{unsubscribe_url}}`), [`lib/email/layout.ts`](../lib/email/layout.ts), `lib/email/send.ts`
All **broadcast** templates pass `unsubscribeUrl: UNSUB` and the layout renders Unsubscribe + Update-preferences links + paid-for-by + postal address — exactly right. **Risk:** the unsubscribe only works if the actual send path replaces `{{unsubscribe_url}}` and `{{preferences_url}}` per recipient and honors opt-outs within 10 business days. This must be verified in `send.ts` / the sending provider, not just the template.
**Fix:** confirm token substitution + suppression-list handling in the send path; add a test that fails if a broadcast send leaves `{{unsubscribe_url}}` unsubstituted.

### 🟠 E-2 — Transactional emails omit unsubscribe (acceptable) — document the distinction
**Where:** `volunteerWelcome`, `donationThankYou`, `contactReceipt` in `lib/email/templates.ts`
These 1:1 transactional emails don't pass `unsubscribeUrl`. That's CAN-SPAM-defensible (transactional/relationship messages), and they still carry paid-for-by + address via the shared footer. 
**Fix:** none required, but document in the Data Policy that transactional receipts are sent without an unsubscribe and supporters can still opt out of all contact by request.

### 🟡 E-3 — Confirm 500+ send threshold triggers mandatory disclaimer handling
**Where:** `lib/email/send.ts`
FEC requires the disclaimer on mass email (>500 substantially similar). The layout always includes paid-for-by (good), so this is satisfied by construction — just confirm no "lightweight" send path bypasses the branded layout.

**🟢 Passing on email:** paid-for-by + committee postal address in every rendered email footer; branded layout used uniformly; plain-text alternative also carries paid-for-by + unsubscribe.

---

## 4. Cross-cutting / policy gaps (the additions you requested)

### 🔴 X-1 — No published Data Policy
Site collects PII (contact form), donor data, and uses email/SES — with no published privacy/data policy. **This is the single most impactful gap.** Draft: [`docs/policies/data-policy.md`](./policies/data-policy.md).

### 🟠 X-2 — No Transparency Policy
No public statement of who funds and runs the site, how content is produced (incl. AI assistance per `CLAUDE.md`), or how corrections are handled. Draft: [`docs/policies/transparency-policy.md`](./policies/transparency-policy.md).

### 🟠 X-3 — No Commitment to Restoring Public Trust
The platform centers anti-corruption ("open the dockets," term limits); a public-facing trust commitment reinforces it and is a natural fit. Draft: [`docs/policies/commitment-to-public-trust.md`](./policies/commitment-to-public-trust.md).

### 🟠 X-4 — Policies need site wiring + footer links
Once approved, add three routes under `app/(site)/` and a footer column. (Code change deferred per scope — these are drafts for your review first.)

### 🟡 X-5 — Establish a "verified-on" discipline for all compliance figures
`CLAUDE.md` already mandates staleness warnings. Several app constants (FEC limit, filing dates) would benefit from an inline verified-on date and a per-cycle re-verification checklist.

---

## Recommended remediation order

1. **Approve & publish the three policies** (drafts ready) + footer links. → resolves X-1, X-2, X-3, P-4.
2. **Donate page:** add contributor-eligibility + "data is public" lines. → P-1, P-2.
3. **Contact form:** add data-use notice + (if texting) consent line. → P-3.
4. **Verify email send pipeline** substitutes unsubscribe tokens + honors opt-outs. → E-1.
5. **Voter-info sourcing** + accessibility pass. → P-5, P-7.
6. **Documentation discipline:** verified-on stamps on FEC limit + filing dates. → D-2, D-4, X-5.

*No application code was changed in this audit. Findings above are recommendations for your review.*
