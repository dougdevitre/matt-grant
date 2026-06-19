// Clerk is optional at build time so the project compiles and deploys before
// keys are wired up. These helpers let the app degrade gracefully: with keys,
// the dashboard is real staff-gated auth; without them, it shows a setup notice.

export const clerkEnabled =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// Belt-and-suspenders authorization: even if Clerk sign-ups are left open,
// only these emails may reach the dashboard + staff APIs. Comma-separated in
// DASHBOARD_ALLOWLIST. If unset, the allowlist is inactive (Clerk auth still
// required) — so the app never locks everyone out by accident.
export const STAFF_ALLOWLIST = (process.env.DASHBOARD_ALLOWLIST ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Opt-in escape hatch for dev/preview: with no allowlist configured, treat any
// signed-in user as an admin. OFF by default so production fails CLOSED — an
// empty/unloaded DASHBOARD_ALLOWLIST must never silently grant everyone admin.
const ALLOW_OPEN_DASHBOARD = process.env.ALLOW_OPEN_DASHBOARD === "true";

export function emailAllowed(email?: string | null): boolean {
  if (!STAFF_ALLOWLIST.length) return ALLOW_OPEN_DASHBOARD; // unset → only open if explicitly allowed
  return !!email && STAFF_ALLOWLIST.includes(email.toLowerCase());
}

// Server-only. Resolves the signed-in user's primary email and the allowlist
// verdict. In demo mode (no Clerk) it's a no-op pass. Callers should already be
// behind middleware auth.protect(), so currentUser() is present when Clerk is on.
import type { StaffRole } from "@/lib/staff";
import { asRole, can, type Capability } from "@/lib/rbac";

export type Gate = { ok: boolean; email: string | null; role: StaffRole | null };

// Role resolution order:
//   1. demo mode (no Clerk) → admin (open dashboard)
//   2. env allowlist → admin (the bootstrap super-admins; also fail-open when
//      DASHBOARD_ALLOWLIST is unset so the app never locks everyone out)
//   3. Clerk publicMetadata.role → the runtime source of truth
//   4. DynamoDB staff row → fallback for invites not yet stamped into Clerk
export async function staffGate(): Promise<Gate> {
  if (!clerkEnabled) return { ok: true, email: null, role: "admin" };
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  if (emailAllowed(email)) return { ok: true, email, role: "admin" };
  const metaRole = asRole((user?.publicMetadata as { role?: unknown } | undefined)?.role);
  if (metaRole) return { ok: true, email, role: metaRole };
  const { staffRole } = await import("@/lib/staff");
  const role = await staffRole(email);
  return { ok: !!role, email, role };
}

// ── Capability guards (the contract feature lanes use to gate surfaces) ──────────
// These exist so a page/route NEVER hardcodes a role and NEVER relies on the
// sidebar hiding a link for its security. The RBAC matrix (lib/rbac.ts) stays the
// single source of truth; callers ask for a capability, not a role.

/**
 * Server-component / page guard. Resolves the signed-in staffer and redirects if
 * they may not perform `capability`:
 *   • not staff at all        → /sign-in
 *   • staff but lacks the cap  → /dashboard?denied=<capability>
 * Returns the resolved Gate on success. Use at the top of a dashboard page:
 *
 *   export default async function Page() {
 *     await requireCap("viewResearch");
 *     ...
 *   }
 */
export async function requireCap(capability: Capability): Promise<Gate> {
  const { redirect } = await import("next/navigation");
  const gate = await staffGate();
  if (!gate.ok) redirect("/sign-in");
  if (!can(gate.role, capability)) redirect(`/dashboard?denied=${capability}`);
  return gate;
}

/**
 * API-route guard. Non-throwing: returns the verdict + gate so the handler can
 * answer with the standard envelope (apiError/forbidden from lib/contracts/api).
 *
 *   const { allowed } = await checkCap("viewDonorDetail");
 *   if (!allowed) return forbidden();
 */
export async function checkCap(capability: Capability): Promise<{ allowed: boolean; gate: Gate }> {
  const gate = await staffGate();
  return { allowed: gate.ok && can(gate.role, capability), gate };
}
