import { describe, it, expect, vi, beforeEach } from "vitest";

// syncStaffRowFromClerk keeps the durable DynamoDB staff row consistent with
// Clerk's authoritative role. DB + staff store are mocked so it runs hermetically.
const setStaffRole = vi.fn(async (..._a: unknown[]) => {});
const removeStaff = vi.fn(async (..._a: unknown[]) => {});
const staffRole = vi.fn(async (..._a: unknown[]) => null as string | null);

vi.mock("@/lib/db", () => ({ dbConfigured: true }));
vi.mock("@/lib/staff", () => ({
  setStaffRole: (...a: unknown[]) => setStaffRole(...a),
  removeStaff: (...a: unknown[]) => removeStaff(...a),
  staffRole: (...a: unknown[]) => staffRole(...a),
}));

import { syncStaffRowFromClerk } from "@/lib/staffSync";

beforeEach(() => vi.clearAllMocks());

describe("syncStaffRowFromClerk", () => {
  it("upserts the staff row to a staff role", async () => {
    await syncStaffRowFromClerk("a@x.com", "captain");
    expect(setStaffRole).toHaveBeenCalledWith("a@x.com", "captain");
    expect(removeStaff).not.toHaveBeenCalled();
  });

  it("normalizes a legacy alias (member → volunteer) before writing", async () => {
    await syncStaffRowFromClerk("a@x.com", "member");
    expect(setStaffRole).toHaveBeenCalledWith("a@x.com", "volunteer");
  });

  it("retires an active staff row when demoted to an external tier", async () => {
    staffRole.mockResolvedValue("captain");
    await syncStaffRowFromClerk("a@x.com", "supporter");
    expect(removeStaff).toHaveBeenCalledWith("a@x.com");
    expect(setStaffRole).not.toHaveBeenCalled();
  });

  it("retires the row on delete (no role) when one exists", async () => {
    staffRole.mockResolvedValue("volunteer");
    await syncStaffRowFromClerk("a@x.com", undefined);
    expect(removeStaff).toHaveBeenCalledWith("a@x.com");
  });

  it("does nothing for an external user with no staff row", async () => {
    staffRole.mockResolvedValue(null);
    await syncStaffRowFromClerk("a@x.com", "supporter");
    expect(setStaffRole).not.toHaveBeenCalled();
    expect(removeStaff).not.toHaveBeenCalled();
  });
});
