# Airtable-governed CRUD across Matt Grant pages

**Goal:** Every page that shows Airtable data (public site + dashboard) should support the
CRUD operations that the campaign's Airtable admins decide it should — with the **Airtable
schema as the source of truth** and an **admin-editable control table** deciding which
operations are exposed on the front end. No deploy needed to turn an operation on/off.

This is a multi-session effort. Track progress in the per-base status checklists below.

---

## The control layer

Today the app is almost entirely **read-only** against Airtable (the only write is the Issues
submission `create`). The registry (`web/lib/airtable/registry.ts`) hardcodes a few table IDs,
and each page hits Airtable through its own bespoke `lib/**/airtable.ts` helper.

We replace that with one admin-governed pattern. In **every base** we add a control table —
**`Front-End Access`** — with one row per `table × audience`:

| Field | Type | Purpose |
|---|---|---|
| Table | Single line text | Must match the real table name in the base |
| Audience | Single select | `public` / `dashboard` |
| Create / Read / Update / Delete | Checkbox ×4 | The CRUD toggles admins flip |
| Editable Fields | Long text (optional) | Comma-list restricting which fields a front-end write may touch (blank = all) |
| Notes | Long text | Why a toggle is on/off |

The app reads `Front-End Access` (cached ~60s, **fail-closed**: a missing row or unchecked box
means the app will NOT perform that operation) and uses it to (a) enable/disable the API route
and (b) show/hide the UI control. Airtable says *what's possible for that audience*; the existing
Clerk `staffGate()` RBAC still decides *which staff member may do it*. Public audience never gets
Update/Delete unless explicitly checked.

The **schema** (`list_tables_for_base` / `get_table_schema`) drives form rendering: singleSelect →
dropdown, date → datepicker, multipleRecordLinks → linked-record picker, checkbox, rating, etc.

---

## Verification & RBAC assurance (how we KEEP it correct)

The dangerous failures here are silent + fail-closed (a renamed table or flipped checkbox just
makes a surface quietly stop working). Two layers turn those into red checks:

- **Hermetic tests** (run in CI / `npm test`, keyless):
  - `lib/airtable/access.test.ts` — fail-closed default, per-op gating, audience match, Editable-Fields narrowing, cache.
  - `lib/airtable/rbac-airtable.test.ts` — locks the role grants (lead-write caps = admin+captain only; no Airtable cap ever reaches donor/supporter/partner).
  - `lib/airtable/governance.test.ts` — registry ids match the real Airtable ids; the manifest is consistent; every generic-editor spec resolves + is full-CRUD in the manifest.
- **Live drift gate** — `scripts/check-airtable-access.ts` (`npm run airtable:drift`) reads each base's
  `Front-End Access` via the PAT and fails on drift vs `lib/airtable/governance-manifest.ts` (missing
  row, flipped checkbox, renamed table, base off the PAT allowlist). Resilient: no key / transient →
  warn + exit 0. Wired into `amplify.yml` preBuild so it runs every deploy. (It already caught one
  real gap — a missing Social `Start Here` excluded row — now fixed.)
- **Source of truth** — `lib/airtable/governance-manifest.ts` (`GOVERNANCE`): the code-side contract
  of every governed surface, consumed by both the test and the drift script.
- **RBAC two-gate**: every write checks a Clerk capability AND the control table; the dashboard layout
  redirects non-staff.
- **Page-level read-RBAC sweep**: every dashboard page now enforces a capability (via `requireCap`, or
  the `staffGate()`+`can()`+redirect pattern) — closed 9 pages that previously leaned on the layout
  staff-gate + sidebar hiding (assets, data, map, photos, print, studio, targets, tasks, volunteers/[id]).
  `app/dashboard/auth-coverage.test.ts` is a regression guard: a new ungated page fails CI.

## Foundation (Phase 0 — once, before base phases)

- [x] `web/lib/airtable/client.ts` — one typed wrapper for `listRecords/getRecord/createRecords/
      updateRecords/deleteRecords` on `getSecret("AIRTABLE_API_KEY")` (env → SSM `/matt-grant/AIRTABLE_API_KEY`).
      Reads degrade to `[]`/`null`; writes throw. Base helpers refactor onto it.
- [x] `web/lib/airtable/access.ts` — reads `Front-End Access`; exposes `can(base, table, audience, op)`,
      `getAccess(...)`, `filterEditableFields(...)`; **fail-closed** default; ~60s cache; `_clearAccessCache()` seam.
- [x] Registry carries `accessTable` id per base (`AIRTABLE_BASES[base].accessTable`) + `BaseKey` type.
- [~] **Decision:** front-end CRUD goes through **server actions** (the codebase idiom — see donors/events),
      each gated by `access.ts` (audience) **and** Clerk `staffGate()` (actor). A generic
      `/api/airtable/[base]/[table]` route is therefore NOT needed; revisit only if an external/non-form
      caller appears.
- [ ] Schema-aware field mapping helper (reads field types → renders the right input). *Deferred to first
      phase that needs rich forms (Social/Volunteer); Issues used hand-built inputs.*
- [ ] Confirm the matt-grant PAT base allowlist includes each `Front-End Access` table (Issues base already
      authorized → control table reads work; re-verify when adding control tables to the other 3 bases).

---

## Repeatable per-phase procedure ("scan each page")

1. **Schema pull** — `list_tables_for_base` + `get_table_schema` → authoritative field list/types.
2. **Page scan** — for each consuming route, read the page + its `lib/**/airtable.ts` helper; record
   *actual* vs *intended* CRUD into the base matrix (table → page → audience → C/R/U/D).
3. **Reconcile** — write the matrix into that base's `Front-End Access` table; that table is the spec.
4. **Implement + verify** — build/route missing ops through the guarded route; flip a toggle in
   Airtable to confirm the UI/API respond without a deploy.

---

## Phase 1 — Issues base (`appbfBEbX8XH3bv4w`) — proving ground

Table: `Submissions` (`tbl63kV5OGFj5bD6c`, renamed from "Table 1").

| Page | Audience | Current | Target |
|---|---|---|---|
| `/issues` | public | Create + Read(approved) | C, R(approved only) |
| `/dashboard` moderation (new) | dashboard | (moderated in Airtable UI) | R(all), U(Status/Details), D(spam) |

- [x] Rename `Table 1` → `Submissions`
- [x] Create `Front-End Access` control table in Issues base + seed rows (public C+R; dashboard R+U+D)
- [x] `client.ts` + `access.ts` foundation
- [x] Route public create/read through `access.ts`
- [x] Dashboard moderation queue (R/U/D): `/dashboard/issues` + actions + IssueModeration component;
      `moderateIssues` capability (admin+captain) + sidebar link

## Phase 2 — Master Database (`apptae7sUEwqFO2tX`) — DONE in code

Table: Influential Voters (`tblBcd7uz3WLHzce2`).

- [x] `Front-End Access` control table (`tblcgIpv6EJgfuR1Y`) + row: `Influential Voters · dashboard`
      = Read + Update; `Editable Fields` = Outreach Stage, Owner, Next Action, Follow-up Date, Outcome,
      Alignment, Notes (synced mailing data stays read-only). Create/Delete off.
- [x] Registry `accessTable` for masterDb.
- [x] `lib/influencers/airtable.ts` refactored onto client+access; read gated; `updateInfluencer()`
      gated by dashboard Update + `filterEditableFields`. Option lists in client-safe
      `lib/influencers/edit-options.ts` (avoids dragging server-only into the client bundle).
- [x] `manageInfluencers` capability (admin+captain); inline-edit UI in `InfluencerTable` +
      `app/dashboard/influencers/actions.ts`. Editing needs the cap AND the control-table Update toggle.

Future option: enable Create/Delete (add contacts / remove) by checking those boxes + adding the UI.

## Phase 3 — Social Media (`appwrqSIsxaZ9Ltun`) — DONE in code

Was greenfield (registry empty). The Airtable Posts table is the no-code **content calendar** —
distinct from the live publishing scheduler in `lib/social/schedule.ts`.

- [x] `Front-End Access` control table (`tblFaPlkj2lIhDazN`) + rows: `Posts · dashboard` = full CRUD
      (Editable Fields = all post fields); `Channels` / `Content Pillars` / `Campaigns` / `Assets · dashboard`
      = Read (for the linked-record pickers). `Start Here` not seeded (fail-closed → no front-end access).
- [x] Registry: socialMedia `accessTable` + 6 table ids (posts, channels, contentPillars, campaigns, assets, startHere).
- [x] `lib/social/content-calendar.ts` — Posts CRUD gated by Posts dashboard toggles + `filterEditableFields`;
      `listChannels/listPillars/listCampaigns` read the lookups into `{id,name}` picker options. Status/Format
      option lists in client-safe `lib/social/calendar-options.ts`.
- [x] New page `/dashboard/social/calendar` + `actions.ts` + `ContentCalendar` component (create/edit/delete,
      linked-record checkbox pickers). Gated by `manageSocial` cap AND the control-table toggles. Sidebar link added.

Future: in-app CRUD for Channels/Pillars/Campaigns/Assets (flip their Create/Update/Delete + add editors).

## Phase 4 — Volunteer Engagement (`appAmtan3qWZE7iGR`) — largest (11 tables)

**Governance layer DONE** — control table (`tblAfRmVuSEayP3Iy`) seeded with a row for all 11 tables;
registry `accessTable` + 8 table ids added.

- [x] **4b Task Templates** — dashboard full CRUD on the curation fields (Task Name, What They Do,
      Status, Priority, Participation Mode, Geo Scope, Effort, Campaign Phase, Contact Pass Type,
      Instructions, Script). `lib/volunteer/task-templates-admin.ts` (separate from the read-only
      picker feed `lib/task-templates.ts`) + `lib/volunteer/task-template-options.ts` (client-safe) +
      page `/dashboard/tasks/templates` + actions + `TaskTemplateManager` component + sidebar link.
      Gated by `manageTasks` cap AND control-table toggles. Linked/multi-select fields stay in Airtable.
- [ ] **4a Events** — investigated, recommendation REVISED: keep the hybrid. Reads already prefer
      Airtable when configured (`listUpcomingEvents`/`getEvent`); RSVPs live in DynamoDB by design.
      The dashboard `EventRow` is a SUPERSET of the Airtable Events schema — checklists, the priority
      rubric, idempotent publish-notify claims, captain/volunteer staffing all live on the DynamoDB
      item. Full "Airtable-as-truth" would REGRESS those, so do NOT do it. If admin↔dashboard event
      consistency is wanted, the right (separate, scoped) project is a one-way **mirror** of dashboard
      content fields → Airtable, keeping operational data in DynamoDB. Control rows left Read-only.
- [x] **4c Field ops** — Canvass Turf, Contact Lists → full dashboard CRUD on the scalar fields via
      the generic editor (extended with `number`/`percent` field types). Specs in
      `lib/volunteer/reference-specs.ts` (FIELDOPS_TABLES), page `/dashboard/field-assignments`,
      `viewTargets` cap. Control rows flipped to CRUD. The linked `Area` (→ Geo Hierarchy) stays
      curated in Airtable (consistent with prior phases) — no linked-record picker needed.
- [x] **4d Lookups** — Roles, Skills, Commitment Levels, Geo Hierarchy → full dashboard CRUD via a
      **generic spec-driven editor**: client-safe specs `lib/volunteer/reference-specs.ts`, generic
      server CRUD `lib/airtable/reference-data.ts`, page `/dashboard/tasks/reference` + actions +
      `ReferenceDataManager`. Control rows flipped to CRUD with per-table Editable Fields. `manageVolunteers`
      cap; per-table buttons appear only when that table's toggle is on. (Linked fields stay in Airtable.)
- [x] **Read-only/excluded** — Start Here, Committee/FEC, Audit/QA control rows seeded with all CRUD off.

---

## Open decisions

- **Events source of truth (4a):** dashboard events are DynamoDB today; public reads Airtable.
  Recommend making Airtable the front-end source of truth (or two-way sync).
- **PAT vs MCP:** record writes go through the PAT (each new `Front-End Access` table must be added
  to its base allowlist); schema introspection stays on the MCP connector.
