// Advanced search/filter/sort config for the dashboard Donors table. Declarative
// facets/sorts over DonorRow; the "also a volunteer" facet needs the volunteer
// email set (and the detail capability) supplied via DonorCtx.
import type { DonorRow } from "@/lib/queries";
import { FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "@/lib/money";
import type { TableConfig, TableCtx } from "./types";

export type DonorCtx = {
  volunteerSet: Set<string>; // lowercased emails present in the volunteer list
  canSeeVolunteerFlag: boolean; // only the detailed (admin) table cross-references
};

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();
const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();
const d = (ctx: TableCtx) => ctx as DonorCtx;
const fecMissing = (r: DonorRow) => !r.employer || !r.occupation;

export const DONOR_TABLE: TableConfig<DonorRow> = {
  id: "donors",
  search: (r) => [r.name, r.email, r.city, r.employer, r.occupation].filter(Boolean).join(" "),
  facets: [
    {
      key: "fec",
      label: "FEC info",
      type: "select",
      options: () => [
        { value: "MISSING", label: "Missing employer/occupation" },
        { value: "COMPLETE", label: "Complete" },
      ],
      match: (r, sel) => {
        const s = sel as string[];
        return (s.includes("MISSING") && fecMissing(r)) || (s.includes("COMPLETE") && !fecMissing(r));
      },
    },
    {
      key: "thanks",
      label: "Thank-you",
      type: "select",
      options: () => [
        { value: "NOT", label: "Not thanked" },
        { value: "DONE", label: "Thanked" },
      ],
      match: (r, sel) => {
        const s = sel as string[];
        return (s.includes("NOT") && !r.thankedAt) || (s.includes("DONE") && !!r.thankedAt);
      },
    },
    {
      key: "city",
      label: "City",
      type: "multi",
      options: (rows) => uniq(rows.map((r) => r.city ?? "")).map((v) => ({ value: v, label: v })),
      match: (r, sel) => r.city != null && (sel as string[]).includes(r.city),
    },
    {
      key: "over",
      label: "Over per-election limit",
      type: "boolean",
      match: (r) => r.totalCents > FEC_INDIVIDUAL_PER_ELECTION_CENTS,
    },
    {
      key: "alsoVolunteer",
      label: "Also a volunteer",
      type: "boolean",
      show: (ctx) => d(ctx).canSeeVolunteerFlag,
      match: (r, _s, ctx) => !!r.email && d(ctx).volunteerSet.has(lc(r.email)),
    },
  ],
  sorts: [
    { key: "amount", label: "Total raised", compare: (a, b) => a.totalCents - b.totalCents },
    { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    { key: "thanked", label: "Thanked", compare: (a, b) => (a.thankedAt || "").localeCompare(b.thankedAt || "") },
  ],
  defaultSort: { key: "amount", dir: "desc" },
  presets: [
    { name: "Missing FEC info", state: { facets: { fec: ["MISSING"] } } },
    { name: "Over per-election limit", state: { facets: { over: true } } },
    { name: "Not thanked yet", state: { facets: { thanks: ["NOT"] } } },
  ],
};
