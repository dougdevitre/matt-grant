import { asRole, type Role } from "@/lib/rbac";

// Resolve messaging recipients straight from Clerk by their RBAC role
// (publicMetadata.role) — the missing primitive for role-targeted email/SMS. This is
// DISTINCT from the data-record audiences (volunteers/donors from DynamoDB): here the
// audience IS "every account whose Clerk role = X".
//
// Clerk's getUserList has no server-side publicMetadata filter, so we page and filter in
// code. Best-effort: returns [] when Clerk isn't configured or on any error (never throws),
// and caps the scan so a huge supporter base can't run unbounded. Consent/suppression is
// applied downstream (email topic opt-outs + SMS opt-in), exactly like the other audiences.

export type ClerkContact = { email: string | null; phone: string | null; firstName?: string };

const PAGE = 200; // Clerk allows up to 500; 200 keeps each call light
const MAX_SCAN = Number(process.env.CLERK_AUDIENCE_MAX_SCAN) || 10_000;

/** All Clerk users whose publicMetadata.role === role, as {email, phone, firstName}. */
export async function listClerkContactsByRole(role: Role): Promise<ClerkContact[]> {
  if (!process.env.CLERK_SECRET_KEY) return [];
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const out: ClerkContact[] = [];
    let scanned = 0;
    for (let offset = 0; offset < MAX_SCAN; offset += PAGE) {
      const { data } = await client.users.getUserList({ limit: PAGE, offset });
      if (!data.length) break;
      scanned += data.length;
      for (const u of data) {
        if (asRole((u.publicMetadata as { role?: unknown } | undefined)?.role) !== role) continue;
        out.push({
          email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null,
          phone: u.primaryPhoneNumber?.phoneNumber ?? u.phoneNumbers[0]?.phoneNumber ?? null,
          firstName: u.firstName ?? undefined,
        });
      }
      if (data.length < PAGE) break;
    }
    if (scanned >= MAX_SCAN) {
      console.warn(`[clerkAudiences] role="${role}" scan hit the ${MAX_SCAN}-user cap — some recipients may be omitted. Raise CLERK_AUDIENCE_MAX_SCAN if needed.`);
    }
    return out;
  } catch (err) {
    console.warn(`[clerkAudiences] listClerkContactsByRole("${role}") failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}
