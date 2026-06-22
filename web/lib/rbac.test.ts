import { describe, it, expect } from "vitest";
import { can, asRole, ROLES, type Capability, type Role } from "@/lib/rbac";

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
  "editFinance",
  "viewDonorDetail",
  "viewCompliance",
  "sendEmailCampaign",
  "manageTeam",
  "viewPeaceRoom",
  "contributePeaceRoom",
];

// The shared Peace Room caps — the ONLY thing a partner may reach.
const PEACE_CAPS: Capability[] = ["viewPeaceRoom", "contributePeaceRoom"];

// The agreed access rules. Captain = field leader + read-only finance/donor
// totals; sending email campaigns + team management = admin only; member = field
// & content; partner = Peace Room only.
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
    ...PEACE_CAPS,
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
  ],
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
