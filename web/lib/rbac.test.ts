import { describe, it, expect } from "vitest";
import {
  can,
  asRole,
  ROLES,
  STAFF_ROLES,
  INVITABLE_ROLES,
  ROLE_LABELS,
  ROLE_BLURBS,
  ROLE_BADGE,
  isStaffRole,
  homeFor,
  postAuthDestination,
  type Capability,
  type Role,
} from "@/lib/rbac";

// Every capability in the matrix. If you add one to rbac.ts, add it here too —
// the count assertions below will otherwise fail, which is the point: the
// access matrix must never drift silently.
const ALL_CAPS: Capability[] = [
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
];

// The shared Peace Room caps — the ONLY thing a partner may reach.
const PEACE_CAPS: Capability[] = ["viewPeaceRoom", "contributePeaceRoom"];

// The agreed access rules. Captain = field leader + read-only finance/donor
// totals; sending email campaigns + team management = admin only; volunteer =
// field & content; donor = supporter + their OWN giving portal; supporter =
// public community hub only; partner = Peace Room only.
const GRANTS: Record<Role, Capability[]> = {
  admin: ALL_CAPS,
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
    ...PEACE_CAPS,
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
    ...PEACE_CAPS,
    "viewCommunity",
  ],
  donor: ["viewCommunity", "viewPeaceRoom", "viewDonorPortal"],
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
    expect(can("volunteer", "manageTeam")).toBe(false);
  });

  it("only admin can send SMS; captains may draft, volunteers/external cannot", () => {
    expect(can("admin", "draftSms")).toBe(true);
    expect(can("admin", "sendSms")).toBe(true);
    expect(can("captain", "draftSms")).toBe(true);
    expect(can("captain", "sendSms")).toBe(false);
    expect(can("volunteer", "draftSms")).toBe(false);
    expect(can("volunteer", "sendSms")).toBe(false);
    expect(can("supporter", "draftSms")).toBe(false);
    expect(can("partner", "sendSms")).toBe(false);
  });

  it("the social command center is admin-only", () => {
    expect(can("admin", "manageSocial")).toBe(true);
    expect(can("captain", "manageSocial")).toBe(false);
    expect(can("volunteer", "manageSocial")).toBe(false);
    expect(can("supporter", "manageSocial")).toBe(false);
    expect(can("partner", "manageSocial")).toBe(false);
  });

  // The donor PORTAL (a donor's view of their OWN giving) is reachable by donor +
  // admin only — and is NOT the internal donor list (that's viewDonorDetail, admin
  // only). A donor must never reach anyone else's data.
  it("viewDonorPortal is donor + admin only; it is NOT viewDonorDetail", () => {
    expect(can("donor", "viewDonorPortal")).toBe(true);
    expect(can("admin", "viewDonorPortal")).toBe(true);
    expect(can("captain", "viewDonorPortal")).toBe(false);
    expect(can("volunteer", "viewDonorPortal")).toBe(false);
    expect(can("supporter", "viewDonorPortal")).toBe(false);
    expect(can("partner", "viewDonorPortal")).toBe(false);
    // the donor's own-giving portal is NOT the internal full donor list
    expect(can("donor", "viewDonorDetail")).toBe(false);
    expect(can("donor", "viewFinanceTotals")).toBe(false);
  });

  // HARD WALL: a donor sees the public surfaces + their OWN giving and NOTHING
  // else private — never the internal donor list, finance, compliance, research,
  // the plan, or team. If this fails, a donor login can reach private data.
  it("donor can reach ONLY community + Peace Room + their own giving — nothing else private", () => {
    const DONOR_CAPS: Capability[] = ["viewCommunity", "viewPeaceRoom", "viewDonorPortal"];
    for (const cap of DONOR_CAPS) expect(can("donor", cap)).toBe(true);
    for (const cap of ALL_CAPS.filter((c) => !DONOR_CAPS.includes(c))) {
      expect(can("donor", cap), `donor must NOT have ${cap}`).toBe(false);
    }
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
    expect(can("partner", "viewDonorPortal")).toBe(false);
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
    expect(can("supporter", "viewDonorPortal")).toBe(false); // not a donor until they give
    expect(can("supporter", "contributePeaceRoom")).toBe(false); // view the board, not edit it
    expect(can("supporter", "viewDonorDetail")).toBe(false);
    expect(can("supporter", "viewFinanceTotals")).toBe(false);
    expect(can("supporter", "manageTeam")).toBe(false);
  });

  it("denies a null / unknown role", () => {
    expect(can(null, "viewOverview")).toBe(false);
    expect(can(undefined, "viewOverview")).toBe(false);
    expect(can("superuser" as Role, "viewOverview")).toBe(false);
  });
});

// Anti-drift invariants: these fail the build if a role is added/renamed without
// updating its label/blurb/badge, or if a role-subset falls out of sync with the
// canonical ROLES list. This is the ratchet that keeps every surface consistent.
describe("rbac invariants (anti-drift)", () => {
  it("every role has a non-empty label, blurb, and badge", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], `label for ${role}`).toBeTruthy();
      expect(ROLE_BLURBS[role], `blurb for ${role}`).toBeTruthy();
      expect(ROLE_BADGE[role], `badge for ${role}`).toBeTruthy();
    }
    // and no stray keys beyond ROLES
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
    expect(Object.keys(ROLE_BLURBS).sort()).toEqual([...ROLES].sort());
    expect(Object.keys(ROLE_BADGE).sort()).toEqual([...ROLES].sort());
  });

  it("STAFF_ROLES and INVITABLE_ROLES are subsets of ROLES and exclude the external tiers", () => {
    for (const r of STAFF_ROLES) expect(ROLES).toContain(r);
    expect(INVITABLE_ROLES).toEqual(STAFF_ROLES);
    expect(STAFF_ROLES).toEqual(["admin", "captain", "volunteer"]);
    for (const external of ["donor", "supporter", "partner"] as Role[]) {
      expect(INVITABLE_ROLES).not.toContain(external);
    }
  });

  it("isStaffRole matches STAFF_ROLES", () => {
    for (const role of ROLES) expect(isStaffRole(role)).toBe(STAFF_ROLES.includes(role));
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });

  it("homeFor routes each tier to its own home", () => {
    expect(homeFor("admin").href).toBe("/dashboard");
    expect(homeFor("captain").href).toBe("/dashboard");
    expect(homeFor("volunteer").href).toBe("/dashboard");
    expect(homeFor("donor").href).toBe("/my-giving");
    expect(homeFor("partner").href).toBe("/dashboard/peace-room");
    expect(homeFor("supporter").href).toBe("/dashboard/peace-room");
    expect(homeFor(null).href).toBe("/community"); // not-yet-stamped floor
  });

  it("postAuthDestination lands each role on the right home after sign-in", () => {
    // The user-facing contract: a signed-in STAFF user (incl. social sign-in via
    // Google/Facebook/LinkedIn resolving to a staff email) lands on the dashboard.
    expect(postAuthDestination("admin")).toBe("/dashboard");
    expect(postAuthDestination("captain")).toBe("/dashboard");
    expect(postAuthDestination("volunteer")).toBe("/dashboard");
    // Peace-Room tiers land on the shared board.
    expect(postAuthDestination("partner")).toBe("/dashboard/peace-room");
    expect(postAuthDestination("donor")).toBe("/dashboard/peace-room");
    expect(postAuthDestination("supporter")).toBe("/dashboard/peace-room");
    // A brand-new signup whose role hasn't stamped yet falls to the public floor.
    expect(postAuthDestination(null)).toBe("/community");
    expect(postAuthDestination(undefined)).toBe("/community");
  });
});

describe("asRole", () => {
  it("accepts the known roles", () => {
    expect(asRole("admin")).toBe("admin");
    expect(asRole("captain")).toBe("captain");
    expect(asRole("volunteer")).toBe("volunteer");
    expect(asRole("donor")).toBe("donor");
    expect(asRole("supporter")).toBe("supporter");
    expect(asRole("partner")).toBe("partner");
  });

  it("maps legacy 'member' and 'organizer' values to 'volunteer' (no migration)", () => {
    expect(asRole("member")).toBe("volunteer");
    expect(asRole("organizer")).toBe("volunteer");
  });

  it("rejects anything else", () => {
    for (const v of ["", "Admin", "owner", null, undefined, 1, {}]) {
      expect(asRole(v)).toBeNull();
    }
  });
});
