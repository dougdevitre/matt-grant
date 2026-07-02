import { asRole, isStaffRole } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { setStaffRole, staffRole, removeStaff } from "@/lib/staff";

// Reconcile the durable DynamoDB staff row with Clerk's authoritative role for one
// email: a staff role (admin/captain/volunteer) upserts the row to that role; any
// other value (an external tier, or cleared — e.g. on user.deleted) retires an
// existing active row so the fallback can't keep granting staff access. Best-effort
// and db-guarded; never throws. Called from the Clerk user.updated/deleted webhook
// and unit-tested here rather than from the route (Next forbids non-handler route
// exports).
export async function syncStaffRowFromClerk(email: string, roleRaw: unknown): Promise<void> {
  if (!dbConfigured) return;
  const role = asRole(roleRaw);
  try {
    if (role && isStaffRole(role)) {
      await setStaffRole(email, role);
    } else if (await staffRole(email)) {
      await removeStaff(email);
    }
  } catch {
    /* best-effort; Clerk remains the source of truth */
  }
}
