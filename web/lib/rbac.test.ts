import { describe, it, expect } from "vitest";
import { can, asRole, ROLES, INVITABLE_ROLES, type Capability, type Role } from "@/lib/rbac";

// Every capability in the matrix. If you add one to rbac.ts, add it here too —
// the count assertions below will otherwise fail, which is the point: the
// access matrix must never drift silently.
const ALL_CAPS: Capability[] = [
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
  "manageEvents",
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
];

// The shared Peace Room caps — the ONLY thing a partner may reach.
const PEACE_CAPS: Capability[] = ["viewPeaceRoom", "contributePeaceRoom"];

// The agreed access rules. Captain = field leader + read-only finance/donor
// totals; sending email campaigns + team management = admin only; member = field
// & content; supporter = public community hub only; partner = Peace Room only.
const GRANTS: Record<Role, Capability[]> = {
  admin: ALL_CAPS,
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
    "manageEvents",
    ...PEACE_CAPS,
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
    ...PEACE_CAPS,
    "viewCommunity",
  ],
  supporter: ["viewCommunity", "viewPeaceRoom"],
  partner: [...PEACE_CAPS],
};

describe("rbac capability matrix", () => {
  for (const role of ROLES) {
    const granted = new Set(GRANTS[role]);
    for (const cap of ALL_CAPS) {
      it(`${role} ${granted.has(cap) ? "can" : "cannot"} ${cap}`, () => {
        expect(can(role, cap)).toBe(granted.has(cap));
      });
    }
  }

  it("captain has read-only finance but cannot edit or see donor detail", () => {
    expect(can("captain", "viewFinanceTotals")).toBe(true);
    expect(can("captain", "editFinance")).toBe(false);
    expect(can("captain", "viewDonorDetail")).toBe(false);
  });

  it("only admin can send email campaigns and manage the team", () => {
    expect(can("admin", "sendEmailCampaign")).toBe(true);
    expect(can("admin", "manageTeam")).toBe(true);
    expect(can("captain", "sendEmailCampaign")).toBe(false);
    expect(can("captain", "manageTeam")).toBe(false);
    expect(can("member", "manageTeam")).toBe(false);
  });

  it("only admin can send SMS; captains may draft, members/external cannot", () => {
    expect(can("admin", "draftSms")).toBe(true);
    expect(can("admin", "sendSms")).toBe(true);
    expect(can("captain", "draftSms")).toBe(true);
    expect(can("captain", "sendSms")).toBe(false);
    expect(can("member", "draftSms")).toBe(false);
    expect(can("member", "sendSms")).toBe(false);
    expect(can("supporter", "draftSms")).toBe(false);
    expect(can("partner", "sendSms")).toBe(false);
  });

  it("the social command center is admin-only", () => {
    expect(can("admin", "manageSocial")).toBe(true);
    expect(can("captain", "manageSocial")).toBe(false);
    expect(can("member", "manageSocial")).toBe(false);
    expect(can("supporter", "manageSocial")).toBe(false);
    expect(can("partner", "manageSocial")).toBe(false);
  });

  // HARD WALL: a partner (external coalition member / allied campaign) may touch
  // ONLY the shared Peace Room — never donors, finance, compliance, internal
  // research, the plan, or team management. If this fails, partner isolation is
  // broken and private campaign data is exposed. Do not weaken it.
  it("partner can reach ONLY the shared Peace Room — nothing private", () => {
    for (const cap of PEACE_CAPS) expect(can("partner", cap)).toBe(true);
    const privateCaps = ALL_CAPS.filter((c) => !PEACE_CAPS.includes(c));
    for (const cap of privateCaps) {
      expect(can("partner", cap), `partner must NOT have ${cap}`).toBe(false);
    }
    // explicit spot-checks on the most sensitive surfaces
    expect(can("partner", "viewDonorDetail")).toBe(false);
    expect(can("partner", "viewFinanceTotals")).toBe(false);
    expect(can("partner", "viewCompliance")).toBe(false);
    expect(can("partner", "manageTeam")).toBe(false);
    expect(can("partner", "viewResearch")).toBe(false);
  });

  // HARD WALL: a supporter (any self-signup from the public) may touch ONLY the
  // community hub + the shared Peace Room board — both render the same public-safe
  // case-for-change content and NOTHING private (never donors, finance, compliance,
  // research, the dashboard tools, the plan, or team management). Opening public
  // signup at launch makes this the most-exercised wall in the app; if it fails,
  // the public can see private campaign data. Do not weaken it.
  const SUPPORTER_CAPS: Capability[] = ["viewCommunity", "viewPeaceRoom"];
  it("supporter can reach ONLY the community hub + shared Peace Room — nothing private or staff", () => {
    for (const cap of SUPPORTER_CAPS) expect(can("supporter", cap)).toBe(true);
    const offLimits = ALL_CAPS.filter((c) => !SUPPORTER_CAPS.includes(c));
    for (const cap of offLimits) {
      expect(can("supporter", cap), `supporter must NOT have ${cap}`).toBe(false);
    }
    // a supporter is not in any private staff dashboard surface
    expect(can("supporter", "viewOverview")).toBe(false);
    expect(can("supporter", "contributePeaceRoom")).toBe(false); // view the board, not edit it
    expect(can("supporter", "viewDonorDetail")).toBe(false);
    expect(can("supporter", "viewFinanceTotals")).toBe(false);
    expect(can("supporter", "manageTeam")).toBe(false);
  });

  // partner must never be assignable from the staff picker / role dropdown — it's
  // provisioned only via the Peace Room invite flow. Guards the one-way wall.
  it("partner is not an invitable staff role", () => {
    expect(INVITABLE_ROLES).not.toContain("partner");
    expect(INVITABLE_ROLES).toEqual(["admin", "captain", "member"]);
  });

  it("denies a null / unknown role", () => {
    expect(can(null, "viewOverview")).toBe(false);
    expect(can(undefined, "viewOverview")).toBe(false);
    expect(can("superuser" as Role, "viewOverview")).toBe(false);
  });
});

describe("asRole", () => {
  it("accepts the four known roles", () => {
    expect(asRole("admin")).toBe("admin");
    expect(asRole("captain")).toBe("captain");
    expect(asRole("member")).toBe("member");
    expect(asRole("partner")).toBe("partner");
  });

  it("maps the legacy 'organizer' value to 'member' (no migration)", () => {
    expect(asRole("organizer")).toBe("member");
  });

  it("rejects anything else", () => {
    for (const v of ["", "Admin", "owner", null, undefined, 1, {}]) {
      expect(asRole(v)).toBeNull();
    }
  });
});
