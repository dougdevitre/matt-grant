// Single source of truth for the campaign's Airtable workspace + bases.
//
// Architecture: all campaign bases live in ONE Airtable workspace ("Matt Grant
// for Congress"). A SINGLE workspace-scoped Personal Access Token — read at
// runtime via getSecret("AIRTABLE_API_KEY") (env-first, else SSM
// /matt-grant/AIRTABLE_API_KEY) — can read every base here AND any base added
// to the workspace later. So onboarding a new base is a one-line edit below;
// no new token, no new secret.
//
// Base/table IDs are NOT secrets — they're public-ish identifiers, safe to keep
// in code. Only the token is a secret (in SSM).

// `accessTable` is the id of the "Front-End Access" control table in that base —
// the admin-editable source of truth for which CRUD operations the website /
// dashboard may perform per table × audience. See lib/airtable/access.ts. A base
// without one (accessTable omitted) is treated as fail-closed: no front-end writes.
export const AIRTABLE_BASES = {
  masterDb: {
    id: "apptae7sUEwqFO2tX",
    accessTable: "tblcgIpv6EJgfuR1Y",
    tables: { influentialVoters: "tblBcd7uz3WLHzce2" },
  },
  volunteer: {
    id: "appAmtan3qWZE7iGR",
    accessTable: "tblAfRmVuSEayP3Iy",
    tables: {
      events: "tblujaq4mmzZdfR3s",
      contactLists: "tblODeXZVb36giy0x",
      taskTemplates: "tblbPnBB2pv38kIC4",
      canvassTurf: "tblDOqUtnCkHVkI1U",
      roles: "tbl3JQ5qSEKRKEZbx",
      skills: "tbl8X1KtyD2NmTp3s",
      commitmentLevels: "tblCwHWNyFkCbtmEr",
      geoHierarchy: "tblx9lPk1LjEtScx5",
    },
  },
  socialMedia: {
    id: "appwrqSIsxaZ9Ltun",
    accessTable: "tblFaPlkj2lIhDazN",
    tables: {
      posts: "tblfhW3BnIQ1ri1WD",
      channels: "tblKcDAyFQ75WG831",
      contentPillars: "tblnRc1ES8AWGMA00",
      campaigns: "tblzasRpW87WVsuy3",
      assets: "tblzA08VUScVF034R",
      startHere: "tbl7NkBg11Ukoakd6",
    },
  },
  issues: {
    id: "appbfBEbX8XH3bv4w",
    accessTable: "tblqV5hSjBdJRtpSS",
    tables: { submissions: "tbl63kV5OGFj5bD6c" },
  },
  // Campaign Expense Budget Builder — planning catalog + expense-approval pipeline.
  // Front-end writes are governed by the base's Front-End Access control table
  // (fail-closed), AND the dashboard's RBAC gates every budget route on top
  // (viewFinanceTotals to read/propose, editFinance to approve/transition).
  // See app/api/budget/*, lib/budget/*, and governance-manifest.ts.
  budget: {
    id: "appiuSYCexFUmGIOr",
    accessTable: "tblI3aWGwDXhHaNGO",
    tables: {
      items: "tblehIxTL9TLTTQ0e",
      expenseRequests: "tblpXHQerkk8OYqt3",
    },
  },
} as const;

/** A key into AIRTABLE_BASES (e.g. "issues", "volunteer"). */
export type BaseKey = keyof typeof AIRTABLE_BASES;

/** Every base id the app expects the workspace token to be able to read. */
export const ALL_BASE_IDS: string[] = Object.values(AIRTABLE_BASES).map((b) => b.id);
