# Roles & permissions — the single source of truth

This app has **one** canonical role/permission model: [`web/lib/rbac.ts`](../lib/rbac.ts). Every
surface (the "View as" switcher, the Team page, invite forms, nav, capability gates, the Clerk webhook)
reads from it. Roles drifted historically because other files hardcoded role strings and labels; the
rule now is **never hardcode a role — ask for a capability via `can(role, capability)`**, and pull labels
from `rbac.ts`. The [`rbac.test.ts`](../lib/rbac.test.ts) invariants fail the build if anything drifts.

## The 6 roles

| Role (`id`) | Label | Tier | Reaches | Assigned by |
|---|---|---|---|---|
| `admin` | Admin | Staff | Everything | Team page invite · env `DASHBOARD_ALLOWLIST` |
| `captain` | Captain | Staff | Field + content + research + plan + **read-only** finance/donor totals; **draft** (not send) email/SMS; events | Team page invite |
| `volunteer` | Volunteer | Staff | Volunteers, tasks, studio, assets, map, targets, overview | Team page invite |
| `donor` | Donor | External | Public community hub + Peace Room **+ a private "my giving" portal** (their own gifts) | **Auto** on donation (WinRed webhook) |
| `supporter` | Supporter | External | Community hub + Peace Room board (public floor) | Auto on self-signup |
| `partner` | Partner | External | Peace Room only | Peace Room invite flow |

- **Staff** = `admin`/`captain`/`volunteer` (`STAFF_ROLES`) — the only roles invitable from the Team page
  (`INVITABLE_ROLES === STAFF_ROLES`).
- **External** = `donor`/`supporter`/`partner` — hard walls; never assignable from the staff picker. The
  isolation tests in `rbac.test.ts` assert none of them can reach anything private.
- **Legacy aliases:** `member` and `organizer` both resolve to `volunteer` via `asRole()` — existing Clerk
  metadata / DynamoDB rows keep working with **no migration**. ("member" was the prior name for the
  `volunteer` role; it is not a 7th role.)

## Where roles live (the store) — precedence
Resolved in `lib/auth.ts` (`resolveRealGate`), highest first:
1. **Demo mode** (no Clerk) → `admin` (open dashboard).
2. **Env allowlist** `DASHBOARD_ALLOWLIST` → `admin` (bootstrap super-admins).
3. **Clerk `publicMetadata.role`** → the runtime source of truth (set by the `user.created` webhook + the
   team page + the donation auto-upgrade).
4. **DynamoDB `staff` row** → fallback for invites not yet stamped into Clerk.

The app uses **only `publicMetadata.role`**, not Clerk's native Organization roles / Roles & Permissions.
(See the source-of-truth decision below.)

## The donor portal + auto-upgrade
- **Portal:** `/my-giving` (`app/(site)/my-giving/page.tsx`) — gated by the `viewDonorPortal` capability
  (donor + admin). It shows the signed-in user's **own** giving only, read self-scoped by `gate.email`
  via `myGiving()` (`lib/donorStatus.ts`) — it never lists anyone else (that's the staff-only
  `viewDonorDetail` Donors page). A non-donor is redirected to `/community`.
- **Auto-upgrade:** the WinRed webhook (`app/api/webhooks/winred/route.ts`), after recording a positive
  gift, calls `upgradeToDonorByEmail()` (`lib/clerkRoles.ts`). **Guarded:** it promotes only `supporter`
  or a not-yet-stamped account → `donor`; it never downgrades staff/partner/existing-donor. Best-effort
  and idempotent; refunds are skipped.

## Capabilities → roles
The matrix is in `rbac.ts` (`MATRIX`/`CAP_SETS`); `rbac.test.ts` asserts the exact grant per role. Highlights:
- `viewFinanceTotals` — admin + captain (read-only); `editFinance`/`viewDonorDetail`/`viewCompliance` — admin.
- `sendEmailCampaign`/`sendSms`/`manageSocial`/`manageTeam` — admin; captains may `draft*`.
- `viewDonorPortal` — donor + admin (the *own-giving* portal, distinct from `viewDonorDetail`).
- `viewPeaceRoom`/`contributePeaceRoom` — the only caps `partner` has; `viewCommunity` — the public hub.

## Drift register (resolved on `claude/rbac-single-source`)
| # | Was | Now |
|---|---|---|
| D1 | Role-literal checks in SiteHeader nav, event staffing, email counts, team split | `homeFor()` / `can(…, "manageEvents")` / `STAFF_ROLES` / `isStaffRole()` |
| D2 | `InviteForm` hardcoded role blurbs | renders from `ROLE_LABELS` + `ROLE_BLURBS` |
| D3 | Team `roleBadge` map missing `supporter` | canonical `ROLE_BADGE` (all roles) in `rbac.ts` |
| D4 | `audiences.ts` `TEAM_ROLES` Set duplicated the staff list | derived from `STAFF_ROLES` |
| D5 | dead `viewPhotos` capability | removed |
| D6 | role store resolution scattered | documented precedence (above); all writes go through `asRole()` |
| — | **anti-drift ratchet** | `rbac.test.ts` asserts every role has a label/blurb/badge, subsets ⊆ `ROLES`, and `homeFor` mapping |

## Source-of-truth decision (app code vs Clerk-native)
The app keeps **`rbac.ts` as the canonical model** (role list, labels, the 25-capability matrix) with
`publicMetadata.role` as the single authoritative *store*. We did **not** migrate to Clerk's native
Roles & Permissions because: Clerk's org-permission model expresses a rich 25-capability matrix poorly;
`donor`/`supporter`/`partner` aren't org members (public/external); and a migration would rewrite every
gate, invite, the webhook, and the view-as preview for little gain (the capability matrix would stay in
code regardless). If Clerk-dashboard visibility is wanted later, mirror the role into a Clerk Organization
role for display only — without moving *enforcement* off the code matrix.
