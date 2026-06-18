// Single source of truth for what each role may do in the War Room.
//
// Roles are stored on the Clerk user as `publicMetadata.role` (with the two
// env-allowlisted bootstrap admins always treated as "admin"). Pages, features,
// and API routes should check a *capability* via can() — never hardcode a role —
// so access rules live in exactly one place.
//
// Decisions baked in (2026-06-18):
//   • 3 roles: admin / captain / organizer
//   • captain = field leader + READ-ONLY finance & donor totals (no editing,
//     no compliance, no role assignment)
//   • sending email campaigns is admins-only (captains may draft)

export type Role = "admin" | "captain" | "organizer";

export const ROLES: Role[] = ["admin", "captain", "organizer"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  captain: "Captain",
  organizer: "Organizer",
};

export const ROLE_BLURBS: Record<Role, string> = {
  admin: "Full access — finance, compliance, donors, email sends, and team management.",
  captain: "Field leader — organizing, content, and research, plus read-only finance & donor totals.",
  organizer: "Field & content — volunteers, tasks, graphics, and the map.",
};

export type Capability =
  // shared
  | "viewOverview"
  | "manageVolunteers"
  | "manageTasks"
  | "useStudio"
  | "manageAssets"
  | "viewPhotos"
  | "viewMap"
  | "viewTargets"
  // captain + admin
  | "viewResearch"
  | "viewPlan"
  | "viewFinanceTotals" // read-only finance + donor totals
  | "draftEmailCampaign"
  // admin only
  | "editFinance"
  | "viewDonorDetail" // full donor list incl. PII / editing
  | "viewCompliance"
  | "sendEmailCampaign"
  | "manageTeam";

// Capabilities granted to each role. Admin is intentionally listed explicitly
// (rather than "all") so adding a new capability forces a conscious decision
// about whether captains/organizers get it.
const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "viewOverview",
    "manageVolunteers",
    "manageTasks",
    "useStudio",
    "manageAssets",
    "viewPhotos",
    "viewMap",
    "viewTargets",
    "viewResearch",
    "viewPlan",
    "viewFinanceTotals",
    "draftEmailCampaign",
    "editFinance",
    "viewDonorDetail",
    "viewCompliance",
    "sendEmailCampaign",
    "manageTeam",
  ],
  captain: [
    "viewOverview",
    "manageVolunteers",
    "manageTasks",
    "useStudio",
    "manageAssets",
    "viewPhotos",
    "viewMap",
    "viewTargets",
    "viewResearch",
    "viewPlan",
    "viewFinanceTotals",
    "draftEmailCampaign",
  ],
  organizer: [
    "viewOverview",
    "manageVolunteers",
    "manageTasks",
    "useStudio",
    "manageAssets",
    "viewPhotos",
    "viewMap",
    "viewTargets",
  ],
};

const CAP_SETS: Record<Role, Set<Capability>> = {
  admin: new Set(MATRIX.admin),
  captain: new Set(MATRIX.captain),
  organizer: new Set(MATRIX.organizer),
};

/** True if the role may perform the capability. Unknown/blank role → denied. */
export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAP_SETS[role]?.has(capability) ?? false;
}

/** Coerce an arbitrary metadata value into a known Role, or null. */
export function asRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as string[]).includes(value) ? (value as Role) : null;
}
