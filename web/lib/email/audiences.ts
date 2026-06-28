import { getVolunteers, getDonors } from "@/lib/queries";
import { listStaff } from "@/lib/staff";
import { segmentEmails, isWayToHelp, type WayToHelp } from "@/lib/profile";
import { isIssueId, type IssueId } from "@/lib/integrations/research/issues";
import { TEAM_GROUPS, STAFF_ROLE_SET, type ContactGroup } from "@/lib/email/audienceGroups";
import { STAFF_ROLES, type Role } from "@/lib/rbac";
import { listClerkContactsByRole } from "@/lib/clerkAudiences";
import type { Recipient } from "@/lib/campaigns";

// Resolve the recipient list for a set of contact groups (+ an optional supporter
// segment), unioned, lowercased, and de-duplicated. Sources reuse the existing
// stores: volunteers/donors from the dashboard queries, captains/all-team from the
// staff allowlist, supporter segments from the profile CRM. Opt-out/suppression is
// applied LATER at send time by the campaign drain — this just selects addresses.
//
// Each recipient carries the first name we can learn for personalization: donors
// and volunteers have a name, staff and supporter segments don't (those fall back
// to the neutral "there" greeting at send time). De-dupe keeps the first name seen.
//
// `internal` is true only when EVERY selected source is a team group (captains /
// all-team) and no external supporter segment is included — those sends bypass
// topic opt-outs (operational), while mixed sends stay conservative.

// All-team = internal staff roles (excludes external donor/supporter/partner rows).
// Derived from the canonical STAFF_ROLES so it can't drift from rbac.ts.
const TEAM_ROLES = new Set<string>(STAFF_ROLES);

// First token of a stored full name → the {{first_name}} merge value.
const firstNameOf = (name?: string | null): string | undefined => (name ?? "").trim().split(/\s+/)[0] || undefined;

export type ResolvedAudience = { recipients: Recipient[]; internal: boolean };

export async function resolveRecipients(
  groups: ContactGroup[],
  segment?: string,
  roles: Role[] = [],
): Promise<ResolvedAudience> {
  const byEmail = new Map<string, Recipient>();
  const add = (email?: string | null, firstName?: string) => {
    const e = email?.trim().toLowerCase();
    if (!e) return;
    const existing = byEmail.get(e);
    if (!existing) byEmail.set(e, firstName ? { email: e, firstName } : { email: e });
    else if (!existing.firstName && firstName) existing.firstName = firstName; // keep the first name we learn for this address
  };

  if (groups.includes("volunteers")) (await getVolunteers()).rows.forEach((v) => add(v.email, firstNameOf(v.name)));
  if (groups.includes("donors")) (await getDonors()).rows.forEach((d) => add(d.email, firstNameOf(d.name)));
  if (groups.includes("captains") || groups.includes("team")) {
    const roles = groups.includes("team") ? TEAM_ROLES : new Set(["captain"]);
    (await listStaff()).filter((s) => s.status === "active" && roles.has(s.role)).forEach((s) => add(s.email));
  }

  // Target by Clerk RBAC role (publicMetadata.role) — distinct from the data-record groups.
  for (const role of roles) {
    (await listClerkContactsByRole(role)).forEach((c) => add(c.email, firstNameOf(c.firstName)));
  }

  let externalSegment = false;
  if (segment?.startsWith("issue:") && isIssueId(segment.slice(6))) {
    (await segmentEmails({ issue: segment.slice(6) as IssueId })).forEach((e) => add(e));
    externalSegment = true;
  } else if (segment?.startsWith("way:") && isWayToHelp(segment.slice(4))) {
    (await segmentEmails({ wayToHelp: segment.slice(4) as WayToHelp })).forEach((e) => add(e));
    externalSegment = true;
  }

  // Internal (bypass topic opt-outs) only when EVERY selected source is staff/team and there's
  // no external segment — an external role (donor/supporter/partner) makes the whole send external.
  const hasExternalGroup = groups.some((g) => !TEAM_GROUPS.has(g));
  const hasExternalRole = roles.some((r) => !STAFF_ROLE_SET.has(r));
  const selected = groups.length > 0 || roles.length > 0 || externalSegment;
  const internal = selected && !hasExternalGroup && !hasExternalRole && !externalSegment;
  return { recipients: [...byEmail.values()], internal };
}
