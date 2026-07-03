// Search/filter/sort config for the dashboard Print tracker. The client table
// groups by category (CATEGORY_ORDER) via <DataTable groupBy>; this config adds
// status/flag facets + item search on top.
import type { PrintItem } from "@/lib/data/printTracker";
import type { TableConfig } from "./types";

// Fixed category order so the queue reads top-to-bottom the way the team works it;
// anything unrecognized falls to the end (groupRows appends unlisted groups).
export const PRINT_CATEGORY_ORDER = [
  "Correspondence",
  "Flyers & handouts",
  "Field & event",
  "Candidate & press",
  "Administrative",
] as const;

const isReady = (r: PrintItem) => r.status === "Draft ready" || r.status === "In hand";

export const PRINT_TABLE: TableConfig<PrintItem> = {
  id: "print",
  search: (r) => [r.item, r.template, r.sheet_size, r.category, r.status].join(" "),
  facets: [
    {
      key: "category",
      label: "Category",
      type: "multi",
      options: (rows) => [...new Set(rows.map((r) => r.category))].sort().map((v) => ({ value: v, label: v })),
      match: (r, sel) => (sel as string[]).includes(r.category),
    },
    {
      key: "ready",
      label: "Ready to print",
      type: "boolean",
      match: (r) => isReady(r),
    },
    {
      key: "flag",
      label: "Compliance flag",
      type: "multi",
      options: () => [
        { value: "disclaimer", label: "Disclaimer" },
        { value: "tax", label: "Tax line" },
        { value: "internal", label: "Internal" },
      ],
      match: (r, sel) => {
        const s = sel as string[];
        return (
          (s.includes("disclaimer") && r.disclaimer_required === "Y") ||
          (s.includes("tax") && r.solicitation_tax_line === "Y") ||
          (s.includes("internal") && r.internal_only === "Y")
        );
      },
    },
  ],
  sorts: [
    { key: "item", label: "Item", compare: (a, b) => a.item.localeCompare(b.item) },
    { key: "status", label: "Status", compare: (a, b) => a.status.localeCompare(b.status) },
    { key: "sheet", label: "Sheet size", compare: (a, b) => a.sheet_size.localeCompare(b.sheet_size) },
  ],
  defaultSort: { key: "item", dir: "asc" },
  presets: [
    { name: "Ready to print", state: { facets: { ready: true } } },
    { name: "Needs disclaimer", state: { facets: { flag: ["disclaimer"] } } },
  ],
};
