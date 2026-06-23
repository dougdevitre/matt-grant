// Pure, client-safe contact-group constants shared by the composer (client), the
// send action (server), and the resolver. No DB/AWS imports here so it can be
// bundled into the client component.

export const CONTACT_GROUPS = ["volunteers", "captains", "donors", "team"] as const;
export type ContactGroup = (typeof CONTACT_GROUPS)[number];

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

/** Readable history label, e.g. "Volunteers + Captains". */
export function audienceLabel(groups: ContactGroup[], segment?: string): string {
  const parts = groups.map((g) => GROUP_LABELS[g]);
  if (segment) parts.push(segment);
  return parts.join(" + ") || "—";
}
