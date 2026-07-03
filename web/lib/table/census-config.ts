// Search/sort config for the Census MO-02 county demographics read view. Small
// dataset (the district's counties), so no facets — just full-text on the county
// name and numeric sorts. Nulls sort last.
import type { CountyAcs } from "@/lib/integrations/census/client";
import type { TableConfig } from "./types";

// Ascending comparator that pushes null/missing values to the end.
const byNum = (get: (r: CountyAcs) => number | null) => (a: CountyAcs, b: CountyAcs) => {
  const x = get(a);
  const y = get(b);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return x - y;
};

export const CENSUS_TABLE: TableConfig<CountyAcs> = {
  id: "census",
  search: (r) => r.name,
  facets: [],
  sorts: [
    { key: "population", label: "Population", compare: byNum((r) => r.population) },
    { key: "income", label: "Median income", compare: byNum((r) => r.medianHouseholdIncome) },
    { key: "age", label: "Median age", compare: byNum((r) => r.medianAge) },
    { key: "homeValue", label: "Median home value", compare: byNum((r) => r.medianHomeValue) },
    { key: "ba", label: "% bachelor's+", compare: byNum((r) => r.bachelorsPlusPct) },
    { key: "children", label: "% households w/ children", compare: byNum((r) => r.householdsWithChildrenPct) },
    { key: "name", label: "County", compare: (a, b) => a.name.localeCompare(b.name) },
  ],
  defaultSort: { key: "population", dir: "desc" },
};
