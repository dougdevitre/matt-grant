// Single source of truth for what each role may do in the Peace Room.
//
// Roles are stored on the Clerk user as `publicMetadata.role` (with the two
// env-allowlisted bootstrap admins always treated as "admin"). Pages, features,
// and API routes should check a *capability* via can() — never hardcode a role —
// so access rules live in exactly one place.
//
// Decisions baked in:
//   • 5 roles: admin / captain / member / supporter / partner
//   • captain = field leader + READ-ONLY finance & donor totals (no editing,
//     no compliance, no role assignment)
//   • member = field & content (was "organizer" — legacy value still accepted)
//   • supporter = the PUBLIC community tier. The default stamped on anyone who
//     self-signs-up at launch. Sees the community hub + the case-for-change board
//     and NOTHING private — no donors, finance, compliance, internal research,
//     plan, or team. A hard wall, like partner: supporters are the public.
//   • partner = the shared Peace Room ONLY. A coalition partner / allied campaign
//     joins to collaborate on the public "time for change" case and can see
//     NOTHING private — no donors, finance, compliance, internal research, plan,
//     or team management. This is a hard wall: partners are external.
//   • sending email campaigns is admins-only (captains may draft)

export type Role = "admin" | "captain" | "member" | "supporter" | "partner";

export const ROLES: Role[] = ["admin", "captain", "member", "supporter", "partner"];

// Roles an admin may assign from the team page. `supporter` is self-assigned at
// signup and `partner` is provisioned through the Peace Room invite flow — neither
// is handed out from the internal staff picker.
export const INVITABLE_ROLES: Role[] = ["admin", "captain", "member"];

// Legacy role values that map onto a current role, so existing Clerk metadata /
// DynamoDB staff rows keep working without a migration. "organizer" → "member".
const ROLE_ALIASES: Record<string, Role> = { organizer: "member" };

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  captain: "Captain",
  member: "Member",
  supporter: "Supporter",
  partner: "Partner",
};

export const ROLE_BLURBS: Record<Role, string> = {
  admin: "Full access — finance, compliance, donors, email sends, and team management.",
  captain: "Field leader — organizing, content, and research, plus read-only finance & donor totals.",
  member: "Field & content — volunteers, tasks, graphics, and the map.",
  supporter: "Community supporter — the community hub + the shared Peace Room case-for-change board. No internal campaign data.",
  partner: "Coalition partner — the shared Peace Room only. No donors, finance, compliance, or internal campaign data.",
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
  | "draftSms" // compose SMS broadcasts (captain may draft)
  | "messageIndividuals" // 1:1 SMS inbox: text individuals, reply, moderate, register texters
  // admin only
  | "editFinance"
  | "viewDonorDetail" // full donor list incl. PII / editing
  | "viewCompliance"
  | "sendEmailCampaign"
  | "sendSms" // send SMS broadcasts to the list (admin only)
  | "manageSocial" // social command center: schedule/publish + profile optimizer
  | "manageTeam"
  // shared Peace Room (the one surface partners can reach)
  | "viewPeaceRoom"
  | "contributePeaceRoom"
  // public community hub (the one surface supporters can reach)
  | "viewCommunity";

// Capabilities granted to each role. Each role is listed explicitly (rather than
// "all") so adding a new capability forces a conscious decision about who gets
// it — especially `partner`, whose list must stay minimal.
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
    "draftSms",
    "messageIndividuals",
    "editFinance",
    "viewDonorDetail",
    "viewCompliance",
    "sendEmailCampaign",
    "sendSms",
    "manageSocial",
    "manageTeam",
    "viewPeaceRoom",
    "contributePeaceRoom",
    "viewCommunity",
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
    "draftSms",
    "messageIndividuals",
    "viewPeaceRoom",
    "contributePeaceRoom",
    "viewCommunity",
  ],
  member: [
    "viewOverview",
    "manageVolunteers",
    "manageTasks",
    "useStudio",
    "manageAssets",
    "viewPhotos",
    "viewMap",
    "viewTargets",
    "viewPeaceRoom",
    "contributePeaceRoom",
    "viewCommunity",
  ],
  // The default for self-signups. Reaches the public community hub AND the shared
  // Peace Room board — both render the same public-safe case-for-change content
  // and expose NOTHING private. Do NOT add private/staff capabilities here; the
  // supporter-isolation test in rbac.test.ts asserts this list stays minimal.
  supporter: ["viewCommunity", "viewPeaceRoom"],
  // HARD WALL — Peace Room only. Do NOT add private capabilities here; the
  // partner-isolation test in rbac.test.ts asserts this list stays minimal.
  partner: ["viewPeaceRoom", "contributePeaceRoom"],
};

const CAP_SETS: Record<Role, Set<Capability>> = {
  admin: new Set(MATRIX.admin),
  captain: new Set(MATRIX.captain),
  member: new Set(MATRIX.member),
  supporter: new Set(MATRIX.supporter),
  partner: new Set(MATRIX.partner),
};

/** True if the role may perform the capability. Unknown/blank role → denied. */
export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAP_SETS[role]?.has(capability) ?? false;
}

/** Coerce an arbitrary metadata value into a known Role (resolving legacy
 *  aliases like "organizer" → "member"), or null. */
export function asRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  if ((ROLES as string[]).includes(value)) return value as Role;
  return ROLE_ALIASES[value] ?? null;
}
