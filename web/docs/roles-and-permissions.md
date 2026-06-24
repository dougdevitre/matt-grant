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

## Consistency across layers (and how to audit it)
A user's role touches five layers. The key property: every read **resolves through `asRole()`**, so the
*effective* role is identical across front-end, back-end, and database even though the **raw stored
strings were never migrated** (a legacy `member`/`organizer` row resolves to `volunteer` everywhere, but
the literal value on disk is unchanged). So "consistent" means two different things per layer:

| Layer | Where the role comes from | Should match the user's *current* role? |
|---|---|---|
| **Front-end** (nav, RoleSwitcher, badges, `/my-giving` gate) | `rbac.ts` + `asRole(publicMetadata.role)` | Yes — resolved |
| **Back-end** (`can()` / `requireCap` / `staffGate`) | `asRole(Clerk role)` → capability | Yes — resolved |
| **Database — `STAFF` row** (`lib/staff.ts`) | raw `role` attr (may be a legacy literal) | Yes on resolve; raw may be stale |
| **Database — `DONOR` / `PROFILE` rows** | *no role stored* — donor tier is **derived** from net gifts (`donorStatus.ts`) | N/A |
| **Clerk `publicMetadata.role`** | raw string — the runtime **source of truth** (`auth.ts` reads it first) | Yes on resolve; raw may be stale |
| **Logs — `AUDIT#access` / `#preview`** (`lib/audit.ts`) | `role`/`prevRole` snapshots at the time of the action | **No — append-only history.** Old entries keep old role names by design; never "migrate" them. |

Two drift risks that resolve-on-read hides:
- **Clerk ↔ DynamoDB desync.** `setMemberRole`/`revokeStaff` write DynamoDB first, then call the
  best-effort `setClerkRoleByEmail`/`clearClerkRoleByEmail` (which **never throw**). A silent Clerk
  failure leaves the read source (Clerk) stale while the `STAFF` fallback has the new value.
- **Donors are Clerk-only by design.** A `donor` has a `publicMetadata.role` but **no `STAFF` row**
  (their tier is computed from contributions). That is expected, not drift — the audit must not flag it.

**Maintenance scripts** (`web/scripts/*.mjs` — run in AWS CloudShell; they mirror the canonical role
list, which `roles-consistency.test.ts` keeps in sync). Read-only unless a write flag is passed:
- `audit-roles.mjs` (`CLERK_SECRET_KEY` + `DYNAMODB_TABLE` + AWS creds) — reconciles **per email** across
  Clerk + `STAFF` + `DONOR`, flagging Clerk↔staff mismatches, stale raw literals, orphan rows, and
  donor-tier anomalies; prints recent audit-log entries as history (FYI). **No writes.**
- `list-clerk-roles.mjs` — tallies `publicMetadata.role` across all Clerk users. **No writes.**
- `staff-list.mjs` — dumps the `STAFF` invite list grouped by role (elevated first) with
  `invitedBy`/`createdAt`, signed-up vs pending, and an external-domain flag (press/gov/role-addr) so
  outside parties stand out. Read-only; `--remove a@b,c@d` soft-removes those rows (`status="removed"`)
  and demotes their Clerk role to `supporter` (the only write path).
- `normalize-roles.mjs` — rewrites legacy raw values (`member`/`organizer`) → canonical in Clerk
  `publicMetadata` + `STAFF` rows. **Dry-run by default; `--apply` writes.** Idempotent and cosmetic
  (reads already coerce) — run it if you want clean raw values; after `--apply`, `audit-roles.mjs` should
  report 0 legacy values.

**Guardrails that keep it from re-drifting** (fail the build):
- `lib/roles-consistency.test.ts` — legacy names (`member`/`organizer`) as string literals exist only in
  `rbac.ts`, and every maintenance script's mirrored role lists stay in sync with `rbac.ts`.
- `lib/rbac.test.ts` — every role has a label/blurb/badge, the role subsets are correct, and the
  capability matrix + isolation walls hold.

A Clerk↔staff *mismatch* would be real drift (re-stamp the stale store). Stale raw values are cosmetic —
`normalize-roles.mjs` cleans them, but the alias map in `rbac.ts` resolves them correctly regardless.
