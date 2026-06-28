// Single source of truth for what each role may do in the campaign app.
//
// Roles are stored on the Clerk user as `publicMetadata.role` (with the two
// env-allowlisted bootstrap admins always treated as "admin"). Pages, features,
// and API routes should check a *capability* via can() — never hardcode a role —
// so access rules live in exactly one place. Where a tier genuinely needs its own
// branch (e.g. which home page a role lands on), use the helpers here (homeFor,
// isStaffRole) rather than re-deriving role lists in components.
//
// Decisions baked in:
//   • 6 roles: admin / captain / volunteer / donor / supporter / partner
//   • captain = field leader + READ-ONLY finance & donor totals (no editing,
//     no compliance, no role assignment)
//   • volunteer = field & content (was "member"/"organizer" — legacy values still
//     accepted via the aliases below; no data migration needed)
//   • donor = a supporter who has given. Sees the public community hub + the shared
//     Peace Room AND a PRIVATE page of their OWN giving history & receipts
//     (viewDonorPortal) — and NOTHING else internal. Auto-assigned when a known
//     account donates (WinRed webhook); never the full donor list / anyone's PII.
//   • supporter = the PUBLIC community tier. The default stamped on anyone who
//     self-signs-up at launch. Sees the community hub + the case-for-change board
//     and NOTHING private. A hard wall, like partner: supporters are the public.
//   • partner = the shared Peace Room ONLY. A coalition partner / allied campaign
//     joins to collaborate on the public "time for change" case and can see
//     NOTHING private. This is a hard wall: partners are external.
//   • sending email campaigns is admins-only (captains may draft)

export type Role = "admin" | "captain" | "volunteer" | "donor" | "supporter" | "partner";

export const ROLES: Role[] = ["admin", "captain", "volunteer", "donor", "supporter", "partner"];

// Internal staff roles — the people with a campaign dashboard login. These are also
// exactly the roles an admin may assign from the team page (INVITABLE_ROLES below).
// External tiers (donor / supporter / partner) are provisioned by their own flows.
export const STAFF_ROLES: Role[] = ["admin", "captain", "volunteer"];

/** True for the internal staff tiers (admin/captain/volunteer). */
export function isStaffRole(role: Role | null | undefined): boolean {
  return !!role && (STAFF_ROLES as string[]).includes(role);
}

// Roles an admin may assign from the team page. Same set as STAFF_ROLES: `donor` is
// auto-assigned on donation, `supporter` is self-assigned at signup, and `partner`
// is provisioned through the Peace Room invite flow — none is handed out from the
// internal staff picker.
export const INVITABLE_ROLES: Role[] = STAFF_ROLES;

// Legacy role values that map onto a current role, so existing Clerk metadata /
// DynamoDB staff rows keep working without a migration. "member" and the older
// "organizer" both resolve to "volunteer".
const ROLE_ALIASES: Record<string, Role> = { member: "volunteer", organizer: "volunteer" };

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  captain: "Captain",
  volunteer: "Volunteer",
  donor: "Donor",
  supporter: "Supporter",
  partner: "Partner",
};

export const ROLE_BLURBS: Record<Role, string> = {
  admin: "Full access — finance, compliance, donors, email sends, and team management.",
  captain: "Field leader — organizing, content, and research, plus read-only finance & donor totals.",
  volunteer: "Field & content — volunteers, tasks, graphics, and the map.",
  donor: "Donor — the community hub, the shared Peace Room, and a private page of your own giving history & receipts. No internal campaign data.",
  supporter: "Community supporter — the community hub + the shared Peace Room case-for-change board. No internal campaign data.",
  partner: "Coalition partner — the shared Peace Room only. No donors, finance, compliance, or internal campaign data.",
};

// Badge styles for the team page / role chips — one entry per role so no surface
// hand-maintains its own partial color map (the rbac.test invariant enforces this).
export const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-brick/10 text-brick",
  captain: "bg-gold/15 text-[#9a6f1a]",
  volunteer: "bg-field/10 text-field",
  donor: "bg-field/15 text-[#1f6f54]",
  supporter: "bg-line text-slate",
  partner: "bg-ink/5 text-slate",
};

export type Capability =
  // shared
  | "viewOverview"
  | "manageVolunteers"
  | "manageTasks"
  | "useStudio"
  | "manageAssets"
  | "viewMap"
  | "viewTargets"
  // captain + admin
  | "viewResearch"
  | "viewPlan"
  | "viewFinanceTotals" // read-only finance + donor totals
  | "draftEmailCampaign"
  | "draftSms" // compose SMS broadcasts (captain may draft)
  | "messageIndividuals" // 1:1 SMS inbox: text individuals, reply, moderate, register texters
  | "manageEvents" // event calendar: create/edit/publish appearances (publish fires email+SMS)
  | "moderateIssues" // issue board: read all submissions, approve/reject/edit, delete spam
  | "manageInfluencers" // influencer worklist: edit outreach pipeline (stage/outcome/next action/etc.)
  // admin only
  | "editFinance"
  | "viewDonorDetail" // full donor list incl. PII / editing
  | "viewCompliance"
  | "sendEmailCampaign"
  | "sendSms" // send SMS broadcasts to the list (admin only)
  | "manageSocial" // social command center: schedule/publish + profile optimizer
  | "manageTeam"
  // donor (the one private surface a donor can reach — their OWN giving only)
  | "viewDonorPortal"
  // shared Peace Room (the one surface partners can reach)
  | "viewPeaceRoom"
  | "contributePeaceRoom"
  // public community hub (the one surface supporters can reach)
  | "viewCommunity";

// Capabilities granted to each role. Each role is listed explicitly (rather than
// "all") so adding a new capability forces a conscious decision about who gets
// it — especially the external tiers, whose lists must stay minimal.
const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "viewOverview",
    "manageVolunteers",
    "manageTasks",
    "useStudio",
    "manageAssets",
    "viewMap",
    "viewTargets",
    "viewResearch",
    "viewPlan",
    "viewFinanceTotals",
    "draftEmailCampaign",
    "draftSms",
    "messageIndividuals",
    "manageEvents",
    "moderateIssues",
    "manageInfluencers",
    "editFinance",
    "viewDonorDetail",
    "viewCompliance",
    "sendEmailCampaign",
    "sendSms",
    "manageSocial",
    "manageTeam",
    "viewDonorPortal",
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
    "viewMap",
    "viewTargets",
    "viewResearch",
    "viewPlan",
    "viewFinanceTotals",
    "draftEmailCampaign",
    "draftSms",
    "messageIndividuals",
    "manageEvents",
    "moderateIssues",
    "manageInfluencers",
    "viewPeaceRoom",
    "contributePeaceRoom",
    "viewCommunity",
  ],
  volunteer: [
    "viewOverview",
    "manageVolunteers",
    "manageTasks",
    "useStudio",
    "manageAssets",
    "viewMap",
    "viewTargets",
    "viewPeaceRoom",
    "contributePeaceRoom",
    "viewCommunity",
  ],
  // A donor: the public surfaces a supporter sees PLUS the private "my giving"
  // portal scoped to their OWN records (viewDonorPortal). Do NOT add staff/finance
  // capabilities here — the donor-isolation test in rbac.test.ts asserts a donor
  // can never reach the internal donor list or anyone else's data.
  donor: ["viewCommunity", "viewPeaceRoom", "viewDonorPortal"],
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
  volunteer: new Set(MATRIX.volunteer),
  donor: new Set(MATRIX.donor),
  supporter: new Set(MATRIX.supporter),
  partner: new Set(MATRIX.partner),
};

/** True if the role may perform the capability. Unknown/blank role → denied. */
export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAP_SETS[role]?.has(capability) ?? false;
}

/** Coerce an arbitrary metadata value into a known Role (resolving legacy
 *  aliases like "member"/"organizer" → "volunteer"), or null. */
export function asRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  if ((ROLES as string[]).includes(value)) return value as Role;
  return ROLE_ALIASES[value] ?? null;
}

// Where a signed-in user's "your account" link should land, by tier. The one
// canonical place that maps a role to its home — components call this instead of
// re-deriving role-string branches. Staff land in the dashboard; a donor lands on
// their private giving page; partner/supporter land in the shared Peace Room; a
// brand-new signup whose role hasn't stamped yet falls through to the public floor.
export function homeFor(role: Role | null | undefined): { href: string; label: string } {
  if (isStaffRole(role)) return { href: "/dashboard", label: "Dashboard" };
  if (role === "donor") return { href: "/my-giving", label: "My giving" };
  if (role === "partner") return { href: "/dashboard/peace-room", label: "Peace Room" };
  if (role === "supporter") return { href: "/dashboard/peace-room", label: "Our Community" };
  return { href: "/community", label: "Our Community" }; // not-yet-stamped floor
}
