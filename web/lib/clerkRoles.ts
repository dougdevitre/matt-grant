import type { Role } from "@/lib/rbac";

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
