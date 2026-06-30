// Advanced search/filter/sort config for the dashboard Volunteers board. Declarative
// facets/sorts over VolunteerRow; runtime values (the signed-in captain, donor/captain
// sets, task counts) come via VolCtx so facets like "My team"/"Donor" can gate + match.
import type { VolunteerRow } from "@/lib/queries";
import type { TableConfig, TableCtx } from "./types";

export type VolCtx = {
  me: string | null;
  donorSet: Set<string>; // lowercased emails
  captainSet: Set<string>; // lowercased emails of active captains
  taskCounts: Record<string, number>;
  canViewDonors: boolean;
};

const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();
const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();
const c = (ctx: TableCtx) => ctx as VolCtx;
function statusOrder(s: string): number {
  return ({ NEW: 0, CONTACTED: 1, ACTIVE: 2, INACTIVE: 3 } as Record<string, number>)[s] ?? 9;
}

export const VOLUNTEER_TABLE: TableConfig<VolunteerRow> = {
  id: "volunteers",
  search: (v) =>
    [v.name, v.email, v.phone, v.city, v.zip, v.interests, v.notes, v.assignedTo, v.captainEmail,
     v.roles.join(" "), v.skills.join(" "), v.interestedTasks.join(" ")]
      .filter(Boolean).join(" "),
  facets: [
    { key: "status", label: "Status", type: "select",
      options: () => ["NEW", "CONTACTED", "ACTIVE", "INACTIVE"].map((v) => ({ value: v, label: v })),
      match: (v, sel) => (sel as string[]).includes(v.status) },
    { key: "door", label: "Door", type: "select",
      options: (rows) => uniq(rows.map((r) => r.door ?? "")).map((v) => ({ value: v, label: v })),
      match: (v, sel) => v.door != null && (sel as string[]).includes(v.door) },
    { key: "role", label: "Roles", type: "multi",
      options: (rows) => uniq(rows.flatMap((r) => r.roles)).map((v) => ({ value: v, label: v })),
      match: (v, sel) => (sel as string[]).some((s) => v.roles.includes(s)) },
    { key: "skill", label: "Skills", type: "multi",
      options: (rows) => uniq(rows.flatMap((r) => r.skills)).map((v) => ({ value: v, label: v })),
      match: (v, sel) => (sel as string[]).some((s) => v.skills.includes(s)) },
    { key: "mode", label: "Mode", type: "select",
      options: () => ["Digital", "In-person", "Either"].map((v) => ({ value: v, label: v })),
      match: (v, sel) => v.mode != null && (sel as string[]).includes(v.mode) },
    { key: "availability", label: "Availability", type: "multi",
      options: (rows) => uniq(rows.flatMap((r) => r.availability)).map((v) => ({ value: v, label: v })),
      match: (v, sel) => (sel as string[]).some((s) => v.availability.includes(s)) },
    { key: "commitment", label: "Commitment", type: "select",
      options: (rows) => uniq(rows.map((r) => r.commitment ?? "")).map((v) => ({ value: v, label: v })),
      match: (v, sel) => v.commitment != null && (sel as string[]).includes(v.commitment) },
    { key: "mine", label: "My team", type: "boolean", show: (ctx) => !!c(ctx).me,
      match: (v, _s, ctx) => !!c(ctx).me && lc(v.captainEmail) === lc(c(ctx).me) },
    { key: "applicant", label: "Captain applicants", type: "boolean",
      match: (v, _s, ctx) => v.door === "Team Captain" && !c(ctx).captainSet.has(lc(v.email)) },
    { key: "unassigned", label: "No captain", type: "boolean", match: (v) => !v.captainEmail },
    { key: "hasTasks", label: "Has tasks", type: "boolean",
      match: (v, _s, ctx) => (c(ctx).taskCounts[v.id] ?? 0) > 0 },
    { key: "optedOut", label: "Opted out", type: "boolean", match: (v) => v.optedOut },
    { key: "pledged", label: "Pledge fulfilled", type: "boolean", match: (v) => v.pledgeFulfilled },
    { key: "donor", label: "Donor", type: "boolean", show: (ctx) => c(ctx).canViewDonors,
      match: (v, _s, ctx) => !!v.email && c(ctx).donorSet.has(lc(v.email)) },
  ],
  sorts: [
    { key: "signedUp", label: "Signed up", compare: (a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") },
    { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    { key: "status", label: "Status", compare: (a, b) => statusOrder(a.status) - statusOrder(b.status) },
    { key: "lastContacted", label: "Last contacted", compare: (a, b) => (a.lastContactedAt || "").localeCompare(b.lastContactedAt || "") },
    { key: "tasks", label: "# tasks", compare: (a, b, ctx) => (c(ctx).taskCounts[a.id] ?? 0) - (c(ctx).taskCounts[b.id] ?? 0) },
  ],
  defaultSort: { key: "signedUp", dir: "desc" },
  presets: [
    { name: "Active volunteers", state: { facets: { status: ["ACTIVE"] } } },
    { name: "Captain applicants", state: { facets: { applicant: true } } },
    { name: "No captain", state: { facets: { unassigned: true } } },
    { name: "Opted out — do not contact", state: { facets: { optedOut: true } } },
  ],
};
