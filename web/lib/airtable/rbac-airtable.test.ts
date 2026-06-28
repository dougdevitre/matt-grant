import { describe, it, expect } from "vitest";
import { can, ROLES, type Capability, type Role } from "@/lib/rbac";

// Lock the role grants for the capabilities that gate Airtable CRUD surfaces, so a future matrix
// edit can't silently widen who can write campaign data (especially to the external tiers).

const STAFF: Role[] = ["admin", "captain"];
const NON_STAFF_WRITE: Role[] = ["volunteer", "donor", "supporter", "partner"];

// Caps that gate WRITE actions in the Airtable CRUD work. Each must be admin+captain only.
const LEAD_WRITE_CAPS: Capability[] = ["moderateIssues", "manageInfluencers"];

// All caps that gate any Airtable surface — none may ever reach the public/external tiers.
const ALL_AIRTABLE_CAPS: Capability[] = [
  "moderateIssues", "manageInfluencers", "manageSocial", "manageTasks", "manageVolunteers", "viewTargets",
];
const EXTERNAL: Role[] = ["donor", "supporter", "partner"];

describe("Airtable CRUD capability grants", () => {
  it("grants the lead-write caps to admin + captain only", () => {
    for (const cap of LEAD_WRITE_CAPS) {
      for (const r of STAFF) expect(can(r, cap), `${r} should have ${cap}`).toBe(true);
      for (const r of NON_STAFF_WRITE) expect(can(r, cap), `${r} must NOT have ${cap}`).toBe(false);
    }
  });

  it("never grants any Airtable capability to an external tier", () => {
    for (const cap of ALL_AIRTABLE_CAPS) {
      for (const r of EXTERNAL) expect(can(r, cap), `${r} must NOT have ${cap}`).toBe(false);
    }
  });

  it("denies every capability to an unknown / blank role", () => {
    for (const cap of ALL_AIRTABLE_CAPS) {
      expect(can(null, cap)).toBe(false);
      expect(can(undefined, cap)).toBe(false);
    }
  });

  it("keeps admin a superset (admin can do everything any role can)", () => {
    for (const cap of ALL_AIRTABLE_CAPS) {
      const anyoneHasIt = ROLES.some((r) => can(r, cap));
      if (anyoneHasIt) expect(can("admin", cap), `admin should have ${cap}`).toBe(true);
    }
  });
});
