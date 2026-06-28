// Pure, client-safe contact-group constants shared by the composer (client), the
// send action (server), and the resolver. No DB/AWS imports here so it can be
// bundled into the client component.
import { ROLE_LABELS, STAFF_ROLES, type Role } from "@/lib/rbac";

export const CONTACT_GROUPS = ["volunteers", "captains", "donors", "team"] as const;
export type ContactGroup = (typeof CONTACT_GROUPS)[number];

// Staff roles are internal — a send to ONLY staff roles (+ team groups) is operational
// and bypasses topic opt-outs, like TEAM_GROUPS. Derived from rbac so it can't drift.
export const STAFF_ROLE_SET: ReadonlySet<Role> = new Set(STAFF_ROLES);

// Team groups are internal staff — sends to ONLY these bypass topic opt-outs.
export const TEAM_GROUPS: ReadonlySet<ContactGroup> = new Set(["captains", "team"]);

export const GROUP_LABELS: Record<ContactGroup, string> = {
  volunteers: "Volunteers",
  captains: "Captains",
  donors: "Donors",
  team: "All-team",
};

export const isContactGroup = (v: unknown): v is ContactGroup =>
  typeof v === "string" && (CONTACT_GROUPS as readonly string[]).includes(v);

/** Readable history label, e.g. "Volunteers + Captains + Role: Donor". */
export function audienceLabel(groups: ContactGroup[], segment?: string, roles: Role[] = []): string {
  const parts = groups.map((g) => GROUP_LABELS[g]);
  for (const r of roles) parts.push(`Role: ${ROLE_LABELS[r]}`);
  if (segment) parts.push(segment);
  return parts.join(" + ") || "—";
}
