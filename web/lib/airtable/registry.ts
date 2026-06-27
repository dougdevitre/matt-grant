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

export const AIRTABLE_BASES = {
  masterDb: {
    id: "apptae7sUEwqFO2tX",
    tables: { influentialVoters: "tblBcd7uz3WLHzce2" },
  },
  volunteer: {
    id: "appAmtan3qWZE7iGR",
    tables: {
      events: "tblujaq4mmzZdfR3s",
      contactLists: "tblODeXZVb36giy0x",
      taskTemplates: "tblbPnBB2pv38kIC4",
    },
  },
  socialMedia: {
    id: "appwrqSIsxaZ9Ltun",
    tables: {},
  },
  issues: {
    id: "appbfBEbX8XH3bv4w",
    tables: {},
  },
} as const;

/** Every base id the app expects the workspace token to be able to read. */
export const ALL_BASE_IDS: string[] = Object.values(AIRTABLE_BASES).map((b) => b.id);
