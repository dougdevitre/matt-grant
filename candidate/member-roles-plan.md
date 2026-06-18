# Member Roles — Tiered Access for the War Room

**Recommendation: yes, add roles.** Today access is binary (allowlisted → sees everything). The War
Room mixes **high-sensitivity** data (donor PII, finances, the filing calendar) with **operational**
tools (field map, volunteers, tasks, graphics). A growing team needs least-privilege: a field captain
shouldn't see donor addresses or cash-on-hand.

## Proposed roles (start with two)

| Role | Who | Can see |
|---|---|---|
| **Admin / Treasurer** | candidate, manager, treasurer, trusted core | **Everything** — incl. Donors, Finance, Compliance, Team & access |
| **Organizer / Team Captain** | field leads, volunteers-of-volunteers | Overview, **Field map · Precinct targets · Volunteers · Tasks · Graphics studio · Asset/Photo library · Strategic plan**, Take Action. **Not** Donors / Finance / Compliance / Team admin |

Room to add **Viewer** (read-only) or **Comms** (media/assets only) later — same mechanism.

### Sensitive (admin-only) surfaces
`/dashboard/donors` · `/dashboard/finance` · `/dashboard/compliance` · `/dashboard/team` and the
donor/finance APIs. Everything else is open to any staff. (Opp research is public-record, so organizers
may keep it.)

## Where the role lives — the Clerk-metadata question

You asked specifically about Clerk metadata. Two options, and a recommended hybrid:

- **Clerk `publicMetadata.role`** — the idiomatic Clerk pattern; the role can ride in the session JWT
  and be enforced in middleware. *Catch:* in our flow **invites happen before the person has a Clerk
  account**, so we can't set their Clerk metadata at invite time.
- **Our DynamoDB staff record** — we already create this at invite (`/dashboard/team`). Adding a
  `role` field means the role is known the moment they're invited, and `staffGate()` already reads it.

**Recommended hybrid:**
1. **Source of truth = the staff record's `role`** (set in the invite UI). Env-allowlist admins and the
   first user default to **admin**.
2. On **first sign-in**, mirror that role into Clerk **`publicMetadata.role`** (so it's also available
   in the JWT/session for middleware-level checks and for Clerk's own dashboard).
3. Per the metadata convention: role is a non-secret label → `publicMetadata`. **Never** put donor PII
   or other sensitive data in Clerk metadata — that stays in DynamoDB. ([[project_clerk_metadata_schema]])

## Implementation

1. `lib/staff.ts`: add `role: "admin" | "organizer"` (default `organizer`); `addStaff(email, name, role, …)`.
2. `lib/auth.ts`: `staffGate()` returns `{ ok, email, role }` (env admins → `admin`).
3. `requireRole("admin")` helper: sensitive pages/actions redirect non-admins to `/dashboard?denied=1`
   with a friendly notice; donor/finance APIs return **403** for organizers.
4. `DashSidebar`: hide admin-only items for organizers (cleaner than dead links).
5. `/dashboard/team` invite form: a **role selector**; show each member's role; let admins change it.
6. On sign-in (dashboard layout), upsert `publicMetadata.role` to match the staff record.

## Security posture after this

- Defense in depth: Clerk auth → email allowlist → **role check** on sensitive pages + APIs.
- Least privilege: organizers operate the field program without touching money or PII.
- Auditable: roles are assigned/visible in `/dashboard/team`.

_Paid for by the Matt Grant for Congress Committee._
