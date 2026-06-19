# lib/contracts — shared interfaces every lane consumes

Owned by **Lane 1 (Foundation)**. These are the stable contracts that let 10 lanes
build in parallel without editing each other's files. Consume them; do not fork them.

## What lives here

- **`api.ts`** — the one API response envelope: `apiOk`, `apiError`, `apiFail`, `unauthorized`,
  `forbidden`. Every route handler returns one of these. `apiFail` logs the real error
  server-side and returns a generic message (no `String(err)` leaks to clients).

## Contracts provided by other Wave-0 lanes (interfaces, so feature lanes can code against them)

- **`requireCap(cap)`** — provided by **Lane 3 (Security)** in `lib/auth.ts`. Page/route guard:

  ```ts
  import { requireCap } from "@/lib/auth";
  // In a server component / route: redirects (pages) or 403s (APIs) if denied.
  const { role } = await requireCap("viewResearch");
  ```

  Feature lanes use this to gate their own pages (fixes the H1 access-control gap) without
  ever editing `rbac.ts`. If you need a **new** capability, request it from Lane 3.

## Insertion-point registries — request, don't edit

To add an entry to any of these, open a one-line request to the owning lane (see `LANES.md`):

| Need | Registry | Owner |
|---|---|---|
| New partition key | `lib/db.ts` → `PK` | Lane 1 |
| New capability | `lib/rbac.ts` → `Capability` + `MATRIX` | Lane 3 |
| New dashboard nav item | `components/dashboard/DashSidebar.tsx` → `ITEMS` | Lane 1 |
| New design token / color | `tailwind.config.ts`, `lib/theme.ts` | Lane 1 |

Lane 1 and Lane 3 pre-declare all *planned* routes, keys, and capabilities during Wave 0,
so these requests should be rare.

## Convention: data layer

- One partition per entity type, keyed by `PK.*`; list with a Query by PK (never Scan).
- IDs via `newId()` from `lib/db.ts`.
- Never construct a second DynamoDB client — import `ddb` from `lib/db.ts`.
