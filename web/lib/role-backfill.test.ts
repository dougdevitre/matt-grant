import { describe, it, expect } from "vitest";
import { resolveRole, type RoleInputs } from "@/lib/role-backfill";

// Defaults to the public floor; each case overrides only what it exercises.
const base: RoleInputs = {
  email: "person@example.com",
  isAdminAllowlisted: false,
  staffRole: null,
  isDonor: false,
};

describe("resolveRole", () => {
  it("stamps admin when the email is on the DASHBOARD_ALLOWLIST", () => {
    expect(resolveRole({ ...base, isAdminAllowlisted: true })).toBe("admin");
  });

  it("stamps the invited staff role (captain/volunteer) when present", () => {
    expect(resolveRole({ ...base, staffRole: "captain" })).toBe("captain");
    expect(resolveRole({ ...base, staffRole: "volunteer" })).toBe("volunteer");
  });

  it("stamps donor when the email has recorded gifts", () => {
    expect(resolveRole({ ...base, isDonor: true })).toBe("donor");
  });

  it("defaults to supporter for a plain self-signup", () => {
    expect(resolveRole(base)).toBe("supporter");
  });

  it("allowlist beats an invited staff role", () => {
    expect(
      resolveRole({ ...base, isAdminAllowlisted: true, staffRole: "volunteer" }),
    ).toBe("admin");
  });

  it("allowlist beats a donor record", () => {
    expect(resolveRole({ ...base, isAdminAllowlisted: true, isDonor: true })).toBe("admin");
  });

  it("a staff role beats a donor record", () => {
    expect(resolveRole({ ...base, staffRole: "volunteer", isDonor: true })).toBe("volunteer");
  });

  it("full precedence order: allowlist > staff > donor > supporter", () => {
    expect(
      resolveRole({ ...base, isAdminAllowlisted: true, staffRole: "captain", isDonor: true }),
    ).toBe("admin");
    expect(resolveRole({ ...base, staffRole: "captain", isDonor: true })).toBe("captain");
    expect(resolveRole({ ...base, isDonor: true })).toBe("donor");
    expect(resolveRole(base)).toBe("supporter");
  });

  it("normalizes a legacy staff value through asRole (organizer/member → volunteer)", () => {
    // asRole resolves legacy aliases; cast since the stored value predates the union.
    expect(resolveRole({ ...base, staffRole: "organizer" as never })).toBe("volunteer");
    expect(resolveRole({ ...base, staffRole: "member" as never })).toBe("volunteer");
  });

  it("falls back to supporter for an unknown/garbage staff value", () => {
    expect(resolveRole({ ...base, staffRole: "wizard" as never })).toBe("supporter");
  });
});
