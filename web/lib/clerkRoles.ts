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
