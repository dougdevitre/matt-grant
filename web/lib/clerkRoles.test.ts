import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Clerk's server client (the function dynamically imports it).
const updateUserMetadata = vi.fn(async () => {});
const getUserList = vi.fn(async () => ({ data: [] as Array<{ id: string; publicMetadata: { role?: string } }> }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUserList, updateUserMetadata } }),
}));

import { upgradeToDonorByEmail } from "@/lib/clerkRoles";

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
