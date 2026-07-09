import { asRole, isStaffRole, type Role } from "@/lib/rbac";

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
export type StaffContact = ClerkContact & { role: Role };

const PAGE = 200; // Clerk allows up to 500; 200 keeps each call light
const MAX_SCAN = Number(process.env.CLERK_AUDIENCE_MAX_SCAN) || 10_000;

// A staffer's number can arrive two ways: a verified Clerk phone (if they added one
// to their profile) or the self-serve "My text alerts" panel, which stores it in
// publicMetadata.phone (no phone-verification flow needed). Prefer the verified one.
type ClerkUserish = {
  primaryPhoneNumber?: { phoneNumber?: string } | null;
  phoneNumbers?: { phoneNumber?: string }[];
  publicMetadata?: unknown;
};
function phoneOf(u: ClerkUserish): string | null {
  return (
    u.primaryPhoneNumber?.phoneNumber ??
    u.phoneNumbers?.[0]?.phoneNumber ??
    (u.publicMetadata as { phone?: unknown } | undefined)?.phone as string | undefined ??
    null
  );
}

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
          phone: phoneOf(u),
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

/** Every internal staffer (role ∈ admin/captain/volunteer) with their role + phone, in
 *  ONE userbase pass — the source for the inbox team quick-pick and the Team page's
 *  reachability column. Best-effort: [] when Clerk is off or on any error. */
export async function listStaffContacts(): Promise<StaffContact[]> {
  if (!process.env.CLERK_SECRET_KEY) return [];
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const out: StaffContact[] = [];
    let scanned = 0;
    for (let offset = 0; offset < MAX_SCAN; offset += PAGE) {
      const { data } = await client.users.getUserList({ limit: PAGE, offset });
      if (!data.length) break;
      scanned += data.length;
      for (const u of data) {
        const role = asRole((u.publicMetadata as { role?: unknown } | undefined)?.role);
        if (!isStaffRole(role)) continue;
        out.push({
          email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? null,
          phone: phoneOf(u),
          firstName: u.firstName ?? undefined,
          role: role as Role,
        });
      }
      if (data.length < PAGE) break;
    }
    if (scanned >= MAX_SCAN) {
      console.warn(`[clerkAudiences] staff scan hit the ${MAX_SCAN}-user cap — some staff may be omitted. Raise CLERK_AUDIENCE_MAX_SCAN if needed.`);
    }
    return out;
  } catch (err) {
    console.warn("[clerkAudiences] listStaffContacts() failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
