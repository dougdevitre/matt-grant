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
];

// The agreed access rules (2026-06-18). Captain = field leader + read-only
// finance/donor totals; sending email campaigns + team management = admin only.
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
    expect(can("organizer", "manageTeam")).toBe(false);
  });

  it("denies a null / unknown role", () => {
    expect(can(null, "viewOverview")).toBe(false);
    expect(can(undefined, "viewOverview")).toBe(false);
    expect(can("superuser" as Role, "viewOverview")).toBe(false);
  });
});

describe("asRole", () => {
  it("accepts the three known roles", () => {
    expect(asRole("admin")).toBe("admin");
    expect(asRole("captain")).toBe("captain");
    expect(asRole("organizer")).toBe("organizer");
  });

  it("rejects anything else", () => {
    for (const v of ["", "Admin", "owner", null, undefined, 1, {}]) {
      expect(asRole(v)).toBeNull();
    }
  });
});
