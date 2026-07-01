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
import { asRole, can, isStaffRole, type Capability, type Role } from "@/lib/rbac";

// `role` is the EFFECTIVE role used for all gating. When an admin is "viewing as"
// a lower role, `role` is that preview while `actualRole` stays "admin" and
// `viewingAs` names the preview. For everyone else, role === actualRole and
// viewingAs is null.
//
// IMPORTANT — `ok` means "a role RESOLVED", NOT "is staff". Every self-signup is
// auto-stamped `supporter` (see the Clerk webhook), so a plain member of the
// public has `ok: true`. Never use `gate.ok` alone to guard a staff-only surface:
// check a capability with checkCap()/can(), or use isStaff()/requireStaff() below
// when the surface maps to no single capability. Gating on `.ok` alone lets any
// signed-in supporter/donor/partner through.
export type Gate = {
  ok: boolean;
  email: string | null;
  role: StaffRole | null;
  actualRole: StaffRole | null;
  viewingAs: Role | null;
};

// Admin-only "view as role" preview cookie (set by the dashboard role switcher).
export const VIEW_AS_COOKIE = "mg_view_as";

// Real role resolution, ignoring any view-as preview. Order:
//   1. demo mode (no Clerk) → admin (open dashboard)
//   2. env allowlist → admin (the bootstrap super-admins; also fail-open when
//      DASHBOARD_ALLOWLIST is unset so the app never locks everyone out)
//   3. Clerk publicMetadata.role → the runtime source of truth
//   4. DynamoDB staff row → fallback for invites not yet stamped into Clerk
async function resolveRealGate(): Promise<{ ok: boolean; email: string | null; role: StaffRole | null }> {
  if (!clerkEnabled) return { ok: true, email: null, role: "admin" };
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  if (emailAllowed(email)) return { ok: true, email, role: "admin" };
  const metaRole = asRole((user?.publicMetadata as { role?: unknown } | undefined)?.role);
  if (metaRole) return { ok: true, email, role: metaRole };
  const { staffRole } = await import("@/lib/staff");
  // Normalize through asRole so a legacy/stale stored value (e.g. "organizer")
  // resolves to a current role rather than slipping through as an unknown one.
  const role = asRole(await staffRole(email));
  return { ok: !!role, email, role };
}

// Read the admin's "view as" preview cookie. Returns a valid LOWER role, or null
// (admin/invalid/absent). Cookie reads can throw outside a request scope, so we
// degrade to null rather than letting a preview break unrelated callers.
async function readViewAs(): Promise<Role | null> {
  try {
    const { cookies } = await import("next/headers");
    const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    const role = asRole(raw);
    return role && role !== "admin" ? role : null;
  } catch {
    return null;
  }
}

export async function staffGate(): Promise<Gate> {
  const real = await resolveRealGate();
  // Only a real admin may preview a lower role. The override can ONLY reduce
  // capability (admin → a lesser role), never escalate — a non-admin's cookie is
  // ignored entirely, so this can't be used to gain access.
  if (real.role === "admin") {
    const viewingAs = await readViewAs();
    if (viewingAs) return { ...real, role: viewingAs, actualRole: "admin", viewingAs };
  }
  return { ...real, actualRole: real.role, viewingAs: null };
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

/**
 * True when the resolved gate is an internal STAFF tier (admin/captain/volunteer).
 * Use this — not `gate.ok` — for a staff-only surface that doesn't map to a single
 * capability. `gate.ok` only means "a role resolved" (any signed-in user, incl. the
 * public supporter/donor/partner tiers), so it is NOT a staff check.
 */
export function isStaff(gate: Gate): boolean {
  return gate.ok && isStaffRole(gate.role);
}

/**
 * Page/server-component guard for a staff-only surface with no single capability.
 * Redirects a non-staff caller: signed-out/unresolved → /sign-in, a resolved but
 * external tier (supporter/donor/partner) → /dashboard?denied=staff. Prefer
 * requireCap() whenever a capability fits; reach for this only for the general
 * "must be staff" case.
 */
export async function requireStaff(): Promise<Gate> {
  const { redirect } = await import("next/navigation");
  const gate = await staffGate();
  if (!isStaff(gate)) redirect(gate.ok ? "/dashboard?denied=staff" : "/sign-in");
  return gate;
}
