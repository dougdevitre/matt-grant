// SOURCE OF TRUTH (code side) for every front-end-governed Airtable surface.
//
// Each entry is what the app EXPECTS the base's "Front-End Access" control table to say for a
// given table × audience. Two consumers verify against it:
//   • lib/airtable/governance.test.ts — hermetic: asserts these tables resolve in the registry
//     and the manifest is internally consistent (no dupes, valid bases/audiences).
//   • scripts/check-airtable-access.mjs — live: reads each base's Front-End Access table via the
//     PAT and fails on drift (missing row, flipped checkbox, renamed table, or unreadable base).
//
// Admins still flip the checkboxes in Airtable — this manifest is the contract the app was built
// against, so a silent divergence (the dangerous, fail-closed kind) becomes a red check.
//
// Client-safe: data only, no server-only imports.
import type { BaseKey } from "@/lib/airtable/registry";
import type { Audience } from "@/lib/airtable/access";

export type GovernedSurface = {
  base: BaseKey;
  table: string; // MUST match the Airtable table name AND the control-table "Table" cell
  audience: Audience;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  /** "ui" = an in-app editor (reads + writes); "write" = write-only intake (e.g. a public
   *  signup that creates but never reads back); "read" = read-only consumer; "excluded" = app must not touch. */
  surface: "ui" | "write" | "read" | "excluded";
};

const crud = (base: BaseKey, table: string, audience: Audience, c: boolean, r: boolean, u: boolean, d: boolean, surface: GovernedSurface["surface"]): GovernedSurface =>
  ({ base, table, audience, create: c, read: r, update: u, delete: d, surface });

export const GOVERNANCE: GovernedSurface[] = [
  // Issues
  crud("issues", "Submissions", "public", true, true, false, false, "ui"),
  crud("issues", "Submissions", "dashboard", false, true, true, true, "ui"),
  // Master DB
  crud("masterDb", "Influential Voters", "dashboard", false, true, true, false, "ui"),
  // Social
  crud("socialMedia", "Posts", "dashboard", true, true, true, true, "ui"),
  crud("socialMedia", "Channels", "dashboard", false, true, false, false, "read"),
  crud("socialMedia", "Content Pillars", "dashboard", false, true, false, false, "read"),
  crud("socialMedia", "Campaigns", "dashboard", false, true, false, false, "read"),
  crud("socialMedia", "Assets", "dashboard", false, true, false, false, "read"),
  // Volunteer — Volunteers roster (public /join creates; no public read/update/delete.
  // The dashboard reads/manages people via DynamoDB, so no dashboard row here.)
  crud("volunteer", "Volunteers", "public", true, false, false, false, "write"),
  // Volunteer — editors
  crud("volunteer", "Task Templates", "dashboard", true, true, true, true, "ui"),
  crud("volunteer", "Canvass Turf", "dashboard", true, true, true, true, "ui"),
  crud("volunteer", "Contact Lists", "dashboard", true, true, true, true, "ui"),
  crud("volunteer", "Roles", "dashboard", true, true, true, true, "ui"),
  crud("volunteer", "Skills", "dashboard", true, true, true, true, "ui"),
  crud("volunteer", "Commitment Levels", "dashboard", true, true, true, true, "ui"),
  crud("volunteer", "Geo Hierarchy", "dashboard", true, true, true, true, "ui"),
  // Volunteer — Events (hybrid: read Airtable, write DynamoDB — read-only from this control table)
  crud("volunteer", "Events", "public", false, true, false, false, "read"),
  crud("volunteer", "Events", "dashboard", false, true, false, false, "read"),
  // Volunteer — excluded (must never be writable from the app)
  crud("volunteer", "Start Here", "dashboard", false, false, false, false, "excluded"),
  crud("volunteer", "Committee / FEC", "dashboard", false, false, false, false, "excluded"),
  crud("volunteer", "Audit / QA", "dashboard", false, false, false, false, "excluded"),
  crud("socialMedia", "Start Here", "dashboard", false, false, false, false, "excluded"),
  // Budget Builder — catalog is read-only; expense pipeline is propose (create) +
  // admin transitions (update). No delete: abandoned requests are Archived.
  crud("budget", "Items", "dashboard", false, true, false, false, "read"),
  crud("budget", "Expense Requests", "dashboard", true, true, true, false, "ui"),
  // Public donate page reads the catalog to show donors what their gift funds.
  crud("budget", "Items", "public", false, true, false, false, "read"),
];
