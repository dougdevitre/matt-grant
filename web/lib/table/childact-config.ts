// Search/filter/sort config for the CHILD Act bills read view. The client table
// groups by relevance tier (core → related → tangential) via <DataTable groupBy>;
// this config adds tier/policy-area facets + title search + score/date sorts.
import type { RankedBill } from "@/lib/analysis/childActView";
import type { TableConfig } from "./types";

const uniq = (vals: (string | null)[]) => [...new Set(vals.filter((v): v is string => !!v))].sort();

export const TIER_LABEL: Record<string, string> = {
  core: "Core relevance",
  related: "Related",
  tangential: "Tangential",
};
export const TIER_ORDER = ["Core relevance", "Related", "Tangential"] as const;
export const tierGroup = (b: RankedBill) => TIER_LABEL[b.relevance.tier ?? "tangential"] ?? "Tangential";

export const CHILDACT_TABLE: TableConfig<RankedBill> = {
  id: "child-act",
  search: (r) => [r.title, r.policyArea, `${r.billType} ${r.number}`, ...r.subjects.map((s) => s.name)].filter(Boolean).join(" "),
  facets: [
    {
      key: "tier",
      label: "Relevance",
      type: "multi",
      options: () => [
        { value: "core", label: "Core" },
        { value: "related", label: "Related" },
        { value: "tangential", label: "Tangential" },
      ],
      match: (r, sel) => (sel as string[]).includes(r.relevance.tier ?? "tangential"),
    },
    {
      key: "policy",
      label: "Policy area",
      type: "multi",
      options: (rows) => uniq(rows.map((r) => r.policyArea)).map((v) => ({ value: v, label: v })),
      match: (r, sel) => r.policyArea != null && (sel as string[]).includes(r.policyArea),
    },
  ],
  sorts: [
    { key: "score", label: "Relevance score", compare: (a, b) => a.relevance.score - b.relevance.score },
    { key: "introduced", label: "Introduced date", compare: (a, b) => (a.introducedDate ?? "").localeCompare(b.introducedDate ?? "") },
    { key: "title", label: "Title", compare: (a, b) => (a.title ?? "").localeCompare(b.title ?? "") },
  ],
  defaultSort: { key: "score", dir: "desc" },
  presets: [{ name: "Core only", state: { facets: { tier: ["core"] } } }],
};
