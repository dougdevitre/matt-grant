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

export function emailAllowed(email?: string | null): boolean {
  if (!STAFF_ALLOWLIST.length) return true; // not configured → allow (auth still required)
  return !!email && STAFF_ALLOWLIST.includes(email.toLowerCase());
}

// Server-only. Resolves the signed-in user's primary email and the allowlist
// verdict. In demo mode (no Clerk) it's a no-op pass. Callers should already be
// behind middleware auth.protect(), so currentUser() is present when Clerk is on.
import type { StaffRole } from "@/lib/staff";
import { asRole } from "@/lib/rbac";

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
