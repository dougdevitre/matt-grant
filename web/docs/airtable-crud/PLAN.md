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
- [x] Create `Front-End Access` control table in Issues base
- [ ] Seed `Front-End Access` rows for Submissions (public + dashboard)
- [ ] `client.ts` + `access.ts` foundation
- [ ] Route public create/read through `access.ts`
- [ ] Dashboard moderation queue (R/U/D) wired through the guarded route

## Phase 2 — Master Database (`apptae7sUEwqFO2tX`)

Table: Influential Voters (`tblBcd7uz3WLHzce2`). Read-only today on `/dashboard/influencers`.
Target: R + U (Outreach Stage, Owner, Next Action, Follow-up Date, Outcome, Alignment, Notes), C, optional D.
`Editable Fields` keeps writes scoped to the outreach pipeline, not the synced mailing data.

## Phase 3 — Social Media (`appwrqSIsxaZ9Ltun`) — greenfield

Not wired today. 6 tables: Posts, Channels, Content Pillars, Campaigns, Assets, Start Here.
Target: dashboard CRUD on the content calendar (`/dashboard/social`). Add all to `registry.ts`.

## Phase 4 — Volunteer Engagement (`appAmtan3qWZE7iGR`) — largest (11 tables)

- 4a Events — public read; dashboard full CRUD (decide Airtable-as-truth vs DynamoDB sync; recommend Airtable-as-truth).
- 4b Task Templates — dashboard add C/U/D.
- 4c Field ops — Canvass Turf, Contact Lists → dashboard CRUD.
- 4d Lookups — Roles, Skills, Commitment Levels, Geo Hierarchy → dashboard CRUD.
- Read-only/excluded — Start Here, Committee/FEC, Audit/QA (all CRUD off in control table).

---

## Open decisions

- **Events source of truth (4a):** dashboard events are DynamoDB today; public reads Airtable.
  Recommend making Airtable the front-end source of truth (or two-way sync).
- **PAT vs MCP:** record writes go through the PAT (each new `Front-End Access` table must be added
  to its base allowlist); schema introspection stays on the MCP connector.
