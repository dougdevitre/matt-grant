import { asRole, type Role } from "@/lib/rbac";

// Promote a contributor to the `donor` role on donation — but ONLY from the public
// floor (a `supporter`, or a signed-up account whose role isn't set yet). It never
// touches staff (admin/captain/volunteer) or `partner`: a teammate or coalition
// partner who chips in keeps their existing role. Best-effort + idempotent (an
// existing donor is left as-is), and a no-op if the giver has no account yet — the
// donor tier still surfaces from their giving regardless. Never throws.
export async function upgradeToDonorByEmail(email?: string | null): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY || !email) return;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const user = data[0];
    if (!user) return; // not a signed-up account — nothing to upgrade
    const current = asRole((user.publicMetadata as { role?: unknown } | undefined)?.role);
    // Only the public tiers are upgraded; staff/partner/existing-donor are untouched.
    if (current === null || current === "supporter") {
      await client.users.updateUserMetadata(user.id, { publicMetadata: { role: "donor" } });
    }
  } catch {
    /* best-effort; the donor view still shows via their giving (donorStatus.ts) */
  }
}

// Best-effort write of an RBAC role to a Clerk user's publicMetadata, by email.
// No-op if Clerk isn't configured or the user hasn't signed up yet — in that
// case the pending DynamoDB staff row + the user.created webhook stamp the role
// on first sign-in. Never throws: the DB row remains the durable record.
export async function setClerkRoleByEmail(email: string, role: Role): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY) return;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const user = data[0];
    if (user) await client.users.updateUserMetadata(user.id, { publicMetadata: { role } });
  } catch {
    /* best-effort; webhook + pending row is the fallback */
  }
}

// Revoke a teammate's access in Clerk: demote them to "supporter" (the public
// floor — no staff/private capabilities) AND revoke their active sessions so the
// change takes effect immediately, not just on their next sign-in. Best-effort:
// no-op without Clerk or if the user never signed up (the removed DynamoDB row is
// the durable record either way). Demoting (vs. deleting) keeps any community-hub
// access and is reversible by re-inviting.
export async function clearClerkRoleByEmail(email: string): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY) return;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    const user = data[0];
    if (!user) return;
    await client.users.updateUserMetadata(user.id, { publicMetadata: { role: "supporter" } });
    // End any live sessions so a currently-signed-in user loses access now.
    try {
      const { data: sessions } = await client.sessions.getSessionList({ userId: user.id, status: "active" });
      await Promise.all(sessions.map((s) => client.sessions.revokeSession(s.id)));
    } catch {
      /* metadata demotion already took effect; session revoke is a bonus */
    }
  } catch {
    /* best-effort; the removed DynamoDB row + allowlist still govern access */
  }
}

// Reconcile Clerk publicMetadata.role FROM the durable DynamoDB staff rows — the
// safety net for the "best-effort Clerk write silently failed" drift (setStaffRole
// updated DynamoDB but setClerkRoleByEmail no-op'd). For each ACTIVE staff row whose
// signed-up Clerk user disagrees, re-stamp Clerk to the staff row's role.
//
// Deliberately narrow + safe: it only touches emails that have an active staff row,
// so it can NEVER downgrade an external tier (donor/supporter/partner have no staff
// row) or a pending invite (no Clerk user yet). The staff row is the authoritative
// record here because the team page writes it in lockstep with Clerk; a Clerk-only
// manual elevation without a matching staff-row change is unsupported (use the team
// page). Best-effort per user; never throws. Returns what it changed for logging.
export async function reconcileStaffRoles(): Promise<{
  checked: number;
  fixed: number;
  changes: { email: string; from: string | null; to: Role }[];
}> {
  const changes: { email: string; from: string | null; to: Role }[] = [];
  if (!process.env.CLERK_SECRET_KEY) return { checked: 0, fixed: 0, changes };
  const { listStaff } = await import("@/lib/staff");
  const staff = (await listStaff()).filter((s) => s.status === "active");
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    for (const s of staff) {
      try {
        const { data } = await client.users.getUserList({ emailAddress: [s.email], limit: 1 });
        const user = data[0];
        if (!user) continue; // pending invite — not signed up yet, nothing in Clerk to fix
        const current = asRole((user.publicMetadata as { role?: unknown } | undefined)?.role);
        if (current !== s.role) {
          await client.users.updateUserMetadata(user.id, { publicMetadata: { role: s.role } });
          changes.push({ email: s.email, from: current, to: s.role });
        }
      } catch {
        /* best-effort per user; keep reconciling the rest */
      }
    }
  } catch {
    /* Clerk unavailable — return what we have (nothing) */
  }
  return { checked: staff.length, fixed: changes.length, changes };
}

// Invite a teammate through Clerk so they can sign up even when the instance is
// in invitation-only ("restricted") mode. The role rides along in the
// invitation's publicMetadata and is applied to the new user on accept. If the
// person already has an account, there's nothing to invite — just set their role.
// Returns whether a Clerk invitation email actually went out.
export async function inviteToClerk(email: string, role: Role): Promise<{ invited: boolean; existing: boolean }> {
  if (!process.env.CLERK_SECRET_KEY) return { invited: false, existing: false };
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ emailAddress: [email], limit: 1 });
    if (data[0]) {
      await client.users.updateUserMetadata(data[0].id, { publicMetadata: { role } });
      return { invited: false, existing: true };
    }
    await client.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role },
      ignoreExisting: true, // re-inviting the same email is fine
    });
    return { invited: true, existing: false };
  } catch {
    // Falls back to the DynamoDB row + user.created webhook (works while the
    // instance still allows open sign-up).
    return { invited: false, existing: false };
  }
}
