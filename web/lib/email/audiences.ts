import { getVolunteers, getDonors } from "@/lib/queries";
import { listStaff } from "@/lib/staff";
import { segmentEmails, isWayToHelp, type WayToHelp } from "@/lib/profile";
import { isIssueId, type IssueId } from "@/lib/integrations/research/issues";
import { TEAM_GROUPS, type ContactGroup } from "@/lib/email/audienceGroups";

// Resolve the recipient list for a set of contact groups (+ an optional supporter
// segment), unioned, lowercased, and de-duplicated. Sources reuse the existing
// stores: volunteers/donors from the dashboard queries, captains/all-team from the
// staff allowlist, supporter segments from the profile CRM. Opt-out/suppression is
// applied LATER at send time by the campaign drain — this just selects addresses.
//
// `internal` is true only when EVERY selected source is a team group (captains /
// all-team) and no external supporter segment is included — those sends bypass
// topic opt-outs (operational), while mixed sends stay conservative.

// All-team = internal staff roles (excludes external partner/supporter rows).
const TEAM_ROLES = new Set(["admin", "captain", "member"]);

export type ResolvedAudience = { emails: string[]; internal: boolean };

export async function resolveRecipients(groups: ContactGroup[], segment?: string): Promise<ResolvedAudience> {
  const out = new Set<string>();
  const add = (e?: string | null) => {
    const n = e?.trim().toLowerCase();
    if (n) out.add(n);
  };

  if (groups.includes("volunteers")) (await getVolunteers()).rows.forEach((v) => add(v.email));
  if (groups.includes("donors")) (await getDonors()).rows.forEach((d) => add(d.email));
  if (groups.includes("captains") || groups.includes("team")) {
    const roles = groups.includes("team") ? TEAM_ROLES : new Set(["captain"]);
    (await listStaff()).filter((s) => s.status === "active" && roles.has(s.role)).forEach((s) => add(s.email));
  }

  let externalSegment = false;
  if (segment?.startsWith("issue:") && isIssueId(segment.slice(6))) {
    (await segmentEmails({ issue: segment.slice(6) as IssueId })).forEach(add);
    externalSegment = true;
  } else if (segment?.startsWith("way:") && isWayToHelp(segment.slice(4))) {
    (await segmentEmails({ wayToHelp: segment.slice(4) as WayToHelp })).forEach(add);
    externalSegment = true;
  }

  const hasExternalGroup = groups.some((g) => !TEAM_GROUPS.has(g));
  const internal = groups.length > 0 && !hasExternalGroup && !externalSegment;
  return { emails: [...out], internal };
}
