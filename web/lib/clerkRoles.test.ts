import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Clerk's server client (the function dynamically imports it).
const updateUserMetadata = vi.fn(async () => {});
const getUserList = vi.fn(async (_opts?: { emailAddress?: string[]; limit?: number }) => ({
  data: [] as Array<{ id: string; publicMetadata: { role?: string } }>,
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUserList, updateUserMetadata } }),
}));

// reconcileStaffRoles reads the staff store (dynamically imported).
const listStaff = vi.fn();
vi.mock("@/lib/staff", () => ({ listStaff: () => listStaff() }));

import { upgradeToDonorByEmail, reconcileStaffRoles } from "@/lib/clerkRoles";

const withUser = (role?: string) =>
  getUserList.mockResolvedValue({ data: [{ id: "u1", publicMetadata: role ? { role } : {} }] });

describe("upgradeToDonorByEmail (auto-assign guard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_SECRET_KEY = "sk_test";
  });
  afterEach(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it("promotes a supporter → donor", async () => {
    withUser("supporter");
    await upgradeToDonorByEmail("a@x.com");
    expect(updateUserMetadata).toHaveBeenCalledWith("u1", { publicMetadata: { role: "donor" } });
  });

  it("promotes a not-yet-stamped account (no role) → donor", async () => {
    withUser(undefined);
    await upgradeToDonorByEmail("a@x.com");
    expect(updateUserMetadata).toHaveBeenCalledWith("u1", { publicMetadata: { role: "donor" } });
  });

  it("NEVER downgrades staff, partner, or an existing donor", async () => {
    for (const role of ["admin", "captain", "volunteer", "partner", "donor"]) {
      vi.clearAllMocks();
      withUser(role);
      await upgradeToDonorByEmail("a@x.com");
      expect(updateUserMetadata, `must not touch ${role}`).not.toHaveBeenCalled();
    }
  });

  it("no-ops when the giver has no account yet", async () => {
    getUserList.mockResolvedValue({ data: [] });
    await upgradeToDonorByEmail("a@x.com");
    expect(updateUserMetadata).not.toHaveBeenCalled();
  });

  it("no-ops without Clerk configured or without an email", async () => {
    delete process.env.CLERK_SECRET_KEY;
    await upgradeToDonorByEmail("a@x.com");
    expect(getUserList).not.toHaveBeenCalled();
    process.env.CLERK_SECRET_KEY = "sk_test";
    await upgradeToDonorByEmail("");
    expect(getUserList).not.toHaveBeenCalled();
  });
});

describe("reconcileStaffRoles (Clerk ← staff-store drift repair)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_SECRET_KEY = "sk_test";
    const users: Record<string, { id: string; publicMetadata: { role?: string } }> = {
      "a@x.com": { id: "u_a", publicMetadata: { role: "volunteer" } }, // drift: row says admin
      "b@x.com": { id: "u_b", publicMetadata: { role: "captain" } }, // in sync
      // c@x.com: pending invite, no Clerk account
    };
    getUserList.mockImplementation(async (opts?: { emailAddress?: string[] }) => {
      const email = opts?.emailAddress?.[0] ?? "";
      return { data: users[email] ? [users[email]] : [] };
    });
  });
  afterEach(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it("re-stamps only the drifted active staffer; skips in-sync, pending, removed", async () => {
    listStaff.mockResolvedValue([
      { email: "a@x.com", role: "admin", status: "active" },
      { email: "b@x.com", role: "captain", status: "active" },
      { email: "c@x.com", role: "volunteer", status: "active" },
      { email: "d@x.com", role: "admin", status: "removed" },
    ]);

    const result = await reconcileStaffRoles();

    expect(result.checked).toBe(3); // the removed row is filtered before checking
    expect(result.fixed).toBe(1);
    expect(result.changes).toEqual([{ email: "a@x.com", from: "volunteer", to: "admin" }]);
    expect(updateUserMetadata).toHaveBeenCalledTimes(1);
    expect(updateUserMetadata).toHaveBeenCalledWith("u_a", { publicMetadata: { role: "admin" } });
  });

  it("no-ops without a Clerk secret", async () => {
    delete process.env.CLERK_SECRET_KEY;
    listStaff.mockResolvedValue([{ email: "a@x.com", role: "admin", status: "active" }]);
    const result = await reconcileStaffRoles();
    expect(result).toEqual({ checked: 0, fixed: 0, changes: [] });
    expect(listStaff).not.toHaveBeenCalled();
  });
});
