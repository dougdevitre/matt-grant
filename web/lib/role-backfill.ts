import { asRole, type Role } from "@/lib/rbac";

// Pure RBAC role resolver for the one-off backfill (scripts/backfill-clerk-roles.ts).
//
// It replicates the precedence of the user.created Clerk webhook
// (app/api/webhooks/clerk/route.ts) — allowlist → admin, then an invited staff
// row → that role, then the public "supporter" floor — and ADDS one reconciliation
// step the webhook can't do at first sign-in: a `donor` tier for an existing
// account that already has recorded gifts. (At first sign-in nobody has donated
// yet, so the webhook never assigns `donor`; donation promotes via the WinRed
// webhook → upgradeToDonorByEmail. Existing pre-webhook users were never stamped
// at all, so this backfill reconciles them in one pass.)
//
// Precedence, highest wins:
//   1. env DASHBOARD_ALLOWLIST match → "admin"  (the bootstrap super-admins)
//   2. an active invited staff row   → that row's role  (admin/captain/volunteer)
//   3. a positive net contribution   → "donor"
//   4. otherwise                     → "supporter"  (the public community floor)
//
// PURE: no I/O, no env reads, no Clerk/DynamoDB. The caller wires the real data
// sources (emailAllowed + DASHBOARD_ALLOWLIST, staffRole, donorSummaryForEmail)
// into the booleans/role below so this stays unit-testable in isolation. The final
// value passes through asRole() ?? "supporter" exactly like the webhook, so a
// legacy/stale staff value (e.g. "organizer") normalizes to a current role rather
// than slipping through unknown.
export type RoleInputs = {
  email: string;
  /** emailAllowed(email) AND a DASHBOARD_ALLOWLIST is actually configured. */
  isAdminAllowlisted: boolean;
  /** Result of staffRole(email): an active invited staff role, or null. */
  staffRole: Role | null;
  /** Whether the email has a positive net contribution on record. */
  isDonor: boolean;
};

export function resolveRole({ isAdminAllowlisted, staffRole, isDonor }: RoleInputs): Role {
  // Mirror the webhook's allowlist→admin / staffRole branch, then layer the donor
  // reconciliation in between staff and the supporter floor.
  const assigned = isAdminAllowlisted
    ? "admin"
    : staffRole ?? (isDonor ? "donor" : null);
  return asRole(assigned) ?? "supporter";
}
