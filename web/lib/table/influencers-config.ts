// Search/filter/sort config for the dashboard Influencer worklist. Replaces the
// former hand-rolled segment chips + "open only" checkbox with the shared engine
// (which adds full-text search, multi-select facets, saved views, and column sort).
import type { InfluencerRow } from "@/lib/influencers/airtable";
import type { TableConfig } from "./types";

// "Open" = not yet resolved to a terminal outcome.
const isOpen = (r: InfluencerRow) => r.outcome !== "Endorsed" && r.outcome !== "Declined";
const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();

export const INFLUENCER_TABLE: TableConfig<InfluencerRow> = {
  id: "influencers",
  search: (r) => [r.name, r.title, r.org, r.segment, r.stage, r.owner, r.email, r.nextAction].filter(Boolean).join(" "),
  facets: [
    {
      key: "segment",
      label: "Segment",
      type: "multi",
      options: (rows) => uniq(rows.map((r) => r.segment)).map((v) => ({ value: v, label: v })),
      match: (r, sel) => (sel as string[]).includes(r.segment),
    },
    {
      key: "stage",
      label: "Stage",
      type: "multi",
      options: (rows) => uniq(rows.map((r) => r.stage)).map((v) => ({ value: v, label: v })),
      match: (r, sel) => (sel as string[]).includes(r.stage),
    },
    {
      key: "open",
      label: "Open (not resolved)",
      type: "boolean",
      match: (r) => isOpen(r),
    },
  ],
  sorts: [
    { key: "influence", label: "Influence", compare: (a, b) => a.influence - b.influence },
    { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    { key: "followUp", label: "Follow-up date", compare: (a, b) => (a.followUp || "").localeCompare(b.followUp || "") },
  ],
  defaultSort: { key: "influence", dir: "desc" },
  presets: [
    { name: "Open worklist", state: { facets: { open: true } } },
    { name: "Top influence", state: { sort: "influence", dir: "desc" } },
  ],
};
