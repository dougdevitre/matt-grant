# Early-Vote Site Verification Checklist & Call Script

A short call script and tracking sheet for clearing the two hard gates —
`buffer_verified` and `property_permission` — on the 11 candidate early-vote sites in
[`early-vote-sites-seed.csv`](./early-vote-sites-seed.csv) before any sign goes out. This
complements [`sign-placement-plan.md`](./sign-placement-plan.md) (the scoring model and
compliance rules) and the confirmed site list in
[`absentee-voting-guide.md`](./absentee-voting-guide.md); it doesn't duplicate either.

> **Educational information, not legal advice.** This is a call-prep aid, not a legal
> determination. Consult a campaign finance / election-law attorney or the relevant
> election authority for guidance specific to your situation.

---

## 1. Why this exists

The seed CSV's addresses are real and already cited in `absentee-voting-guide.md`
(verified July 10, 2026), but the scoring tool's two hard gates —
`buffer_verified` (25-ft electioneering buffer, per §9.1 of the sign plan) and
`property_permission` (signage allowed on that specific property, per §9.3) — are
**compliance facts a document can't confirm on its own.** Every row in the seed CSV
ships with both set to `false`, so every site lands in the Signs page's dropped/audit
table until a human calls, confirms, and flips them. This checklist is that call.

**No coordinates are included either** — geocode each address once confirmed, rather
than guess. The scoring model doesn't require lat/lng to rank a site; the map view just
won't plot it until you add coordinates.

---

## 2. The call script

Use this for every site, whether it's the county Board of Elections, a rural clerk's
office, or a library/rec-complex site they've designated.

1. "Hi, I'm calling to confirm early-voting details for the August 4 primary. Is
   **[site name]** an active early-voting or Election-Day site this cycle?"
2. "What are its early-voting hours, and does that differ from Election Day hours?"
3. "Is campaign signage allowed on the property, and if so, where — and is there a
   25-foot (or locally-specified) no-electioneering zone I should stay outside of?"
4. "Who do I need written permission from to place a sign on this property — the
   election authority, the building/site owner, or both?"
5. "Is there a removal deadline after early voting or Election Day ends?"

Log the answers in the tracking table below. A `false`→`true` flip on
`buffer_verified` or `property_permission` in the seed CSV should only happen **after**
this call confirms it — never in advance of the call.

---

## 3. Site tracker

| Site | Phone | Called (date) | Active early-vote site? | Buffer confirmed | Permission confirmed | Notes |
|---|---|---|---|---|---|---|
| St. Louis County Board of Elections | 314.615.1833 | | | | | |
| North County Rec Complex | 314.615.1833 (BOE) | | | | | |
| UMSL Millennium Student Center | 314.615.1833 (BOE) | | | | | |
| Daniel Boone Library | 314.615.1833 (BOE) | | | | | |
| Grand Glaize Library | 314.615.1833 (BOE) | | | | | |
| Mid-County Library | 314.615.1833 (BOE) | | | | | |
| St. Johns UCC | 314.615.1833 (BOE) | | | | | |
| Jefferson County Clerk | 636.797.5486 | | | | | |
| Washington County Clerk | 573.436.7704 | | | | | |
| Crawford County Clerk | 573.775.2376 | | | | | |
| Gasconade County Clerk | 573.486.5427 | | | | | |

Contacts sourced from `absentee-voting-guide.md` (verified July 10, 2026). The four
rural sites are the county Clerk's own office (Jefferson, Washington, Crawford,
Gasconade all serve as their county's early-voting location) — the "site" and the
"election authority" are the same building.

---

## 4. After the call

1. Update the row in `early-vote-sites-seed.csv`: flip `buffer_verified` and/or
   `property_permission` to `true` only for what was actually confirmed; add the
   geocoded lat/lng once known.
2. Paste the updated CSV into **Dashboard → Field → Signs** (`/dashboard/signs`) to see
   it move from the dropped table into the ranked deploy list.
3. A site that can't get permission, or has no confirmable buffer clearance, stays
   `false` — do not deploy there. That's the audit trail working as intended.

---

## 5. See also

- [`sign-placement-plan.md`](./sign-placement-plan.md) — the full scoring model and §9
  compliance rules (buffer, right-of-way, permission, municipal teardown deadlines).
- [`absentee-voting-guide.md`](./absentee-voting-guide.md) — the voter-facing guide this
  checklist's site list and contacts are drawn from.
- [`early-vote-sites-seed.csv`](./early-vote-sites-seed.csv) — the seed data this
  checklist verifies.
