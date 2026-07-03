"use client";

import { DataTable } from "@/components/dashboard/DataTable";
import { CENSUS_TABLE } from "@/lib/table/census-config";
import type { CountyAcs } from "@/lib/integrations/census/client";
import type { ColumnDef } from "@/lib/table/types";

// Read view for the Census MO-02 county demographics source (Resource<CountyAcs[]>).
// Renders on the shared <DataTable> — sortable numeric columns + county search + CSV.

const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));
const usd = (n: number | null) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`);
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const age = (n: number | null) => (n == null ? "—" : n.toFixed(1));
const csvNum = (n: number | null) => (n == null ? "" : String(n));
const right = "font-mono tabular-nums";

const COLUMNS: ColumnDef<CountyAcs>[] = [
  {
    key: "name",
    header: "County",
    sortable: true,
    cell: (r) => (
      <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">
        {r.name}
      </a>
    ),
    csv: (r) => r.name,
  },
  { key: "population", header: "Population", align: "right", sortable: true, cellClassName: right, cell: (r) => num(r.population), csv: (r) => csvNum(r.population) },
  { key: "income", header: "Median income", align: "right", sortable: true, cellClassName: right, cell: (r) => usd(r.medianHouseholdIncome), csv: (r) => csvNum(r.medianHouseholdIncome) },
  { key: "age", header: "Median age", align: "right", sortable: true, cellClassName: right, cell: (r) => age(r.medianAge), csv: (r) => csvNum(r.medianAge) },
  { key: "homeValue", header: "Median home value", align: "right", sortable: true, cellClassName: right, cell: (r) => usd(r.medianHomeValue), csv: (r) => csvNum(r.medianHomeValue) },
  { key: "ba", header: "% bachelor's+", align: "right", sortable: true, cellClassName: right, cell: (r) => pct(r.bachelorsPlusPct), csv: (r) => csvNum(r.bachelorsPlusPct) },
  { key: "children", header: "% HH w/ children", align: "right", sortable: true, cellClassName: right, cell: (r) => pct(r.householdsWithChildrenPct), csv: (r) => csvNum(r.householdsWithChildrenPct) },
];

export function CensusTable({ rows }: { rows: CountyAcs[] }) {
  return (
    <DataTable
      columns={COLUMNS}
      config={CENSUS_TABLE}
      rows={rows}
      ctx={{}}
      rowKey={(r) => r.countyFips}
      emptyLabel="No county rows match these filters."
      summary={(f) => `${f.length} count${f.length === 1 ? "y" : "ies"}`}
      minWidthClass="min-w-[52rem]"
      csvFilename="mo02-census-counties.csv"
    />
  );
}
