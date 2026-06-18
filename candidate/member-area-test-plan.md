# Gated Member Area — Inventory & Test Plan

The gated area is the **campaign War Room** at `/dashboard` — staff-only operational tools and
sensitive data that never appear on the public site. Access = Clerk sign-in **and** an allowlisted
email (`DASHBOARD_ALLOWLIST`). Today the allowlist is `dougdevitre@gmail.com`.

## 1. What the member area has that the public site does NOT

| Member area (`/dashboard/*`) | What it is | Why it's gated |
|---|---|---|
| **Overview** | Campaign snapshot / KPIs | internal numbers |
| **Donors** | Log contributions, donor list & history | donor **PII**, FEC data |
| **Finance** | Money in & out, expenditures, cash position | financials |
| **Compliance** | Filing calendar & deadlines | internal compliance ops |
| **3D field map** | MapLibre 3D MO-02 precinct turnout map | targeting intel |
| **Precinct targets** | Ranked precinct list, GOTV upside, tiers | field strategy |
| **Graphics studio** | Generate on-brand graphics from Matt's photo | production tool |
| **Asset library** | S3 browser (public + private), upload, signed URLs | staff file mgmt |
| **Photo library** | Private shoot photos via signed URLs + promote | unreleased media |
| **Volunteers** | Supporter/volunteer intake (from the contact form) | supporter **PII** |
| **Task board** | Campaign task management | internal ops |
| **Opp. research** | Congress.gov + roll-call record (the opponent) | research |
| **Strategic plan** | The plan to win MO-02 | strategy |

**Public site (no login):** Home · About Matt · Issues (+ per-issue videos) · Donate · Media
(download graphics/captions/print/video) · Press (news + AI interview topics + booking) · Contact ·
**Take Action** (personalized action plans) · sign-in/up.

> Net: the public site is **outreach** (persuade, share, donate, act); the member area is **operations**
> (manage money, people, field, research, production).

## 2. Test the full user flow

Run on the live site (`…amplifyapp.com`). Expected results in **bold**.

### A. Create an account
1. Visit `/dashboard` → **redirects to `/sign-in`**.
2. Choose "Sign up" → enter **`dougdevitre@gmail.com`** + a password (or email code).
3. Complete Clerk's **email verification** (code/link). → **lands in `/dashboard`** (allowlisted).

### B. Authentication behaviors
4. Reload `/dashboard` → **stays in** (session persists).
5. Open `/dashboard` in a new tab / on mobile → **still signed in**.
6. Click the **UserButton** (top-right) → **Sign out** → `/dashboard` now **redirects to `/sign-in`**.
7. Sign up with a **different, non-allowlisted email** → authenticates, but `/dashboard` **redirects to
   `/?staff=denied`** (allowlist backstop working).

### C. Use the member resources (smoke test each)
8. **Overview** loads with the sidebar.
9. **Donors** → log a test contribution → it appears in the list.
10. **Finance** → reflects the test entry.
11. **Volunteers** → shows any contact-form submissions.
12. **Graphics studio** → generate a sample graphic.
13. **Asset library / Photo library** → list loads; a private item returns via a **signed URL** (and a
    direct CDN hit to a `private/` path is **403**).
14. **3D field map / Precinct targets** → render (map data may be empty until ingested — that's OK).
15. **Task board / Compliance / Opp. research / Strategic plan** → pages load.

### D. API authorization (optional, technical)
16. Signed out: `GET /api/assets/list` → **401**.
17. Signed in but **not** allowlisted: → **403**. Allowlisted: → **200**.

## 3. Already verified (automated, live)

- `/dashboard` (signed out) → **307 → /sign-in** ✓
- `/sign-in`, `/sign-up` → **200** ✓
- `/api/assets/list` (no auth) → **401** ✓
- Allowlist = `dougdevitre@gmail.com` ✓

## 4. Notes

- **Dev instance:** Clerk is on `pk_test` (Development) — expect a small "development" banner; that's
  normal. Production instance + custom domain is covered in `clerk-production-plan.md`.
- **Add staff:** give me their emails → I extend `DASHBOARD_ALLOWLIST` + redeploy.
- **Staff vs supporter members:** this gated area is the **staff** War Room. If you also want a
  **supporter** member tier (volunteers log in for toolkits/streaks), that's a separate, open-sign-up
  experience — happy to plan it.

_Paid for by the Matt Grant for Congress Committee._
