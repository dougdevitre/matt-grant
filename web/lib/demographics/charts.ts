// Chart manifest: the bridge between the validated datasets (schema.ts) and the
// <Figure> component. Each entry carries the citation, a text alternative (the
// chart's takeaway in words — WCAG 1.1.1), and an always-available data table so a
// figure is accessible and useful BEFORE its Datawrapper SVG export lands. When the
// static export is committed to web/public/charts/<id>.svg, flip `hasExport` true.
import "server-only";
import {
  DEMOGRAPHICS_SOURCE,
  loadChildUnder15ByCounty,
  loadUnder5DeclineByMetro,
  loadStCharlesAgeStructure,
  loadAgingIndexByMetro,
  loadMsaPopulationByAge,
  mo02Counties,
} from "./schema";

export type ChartTable = { columns: string[]; rows: (string | number)[][] };
export type ChartDef = {
  id: string;
  title: string;
  /** Text alternative — states the chart's finding in words (never "chart of X"). */
  alt: string;
  source: string;
  /** True once web/public/charts/<id>.svg is committed (Datawrapper export). */
  hasExport: boolean;
  table: () => ChartTable;
};

const rows = <T,>(r: { ok: boolean; data: T[] | null }): T[] => (r.ok && r.data ? r.data : []);
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

export const CHARTS: Record<string, ChartDef> = {
  "mo02-child-under15": {
    id: "mo02-child-under15",
    title: "Children under 15 are declining across MO-02",
    alt:
      "Children under 15 fell in most MO-02 counties from 2020 to 2025: St. Louis County −5.9%, " +
      "Jefferson −5.6%, St. Charles −3.8%, Franklin −3.2%; Lincoln (+5.0%) and Warren (+0.6%) grew.",
    source: DEMOGRAPHICS_SOURCE,
    hasExport: false,
    table: () => ({
      columns: ["County", "2020", "2025", "Change", "% change"],
      rows: mo02Counties(rows(loadChildUnder15ByCounty())).map((r) => [
        r.county, r.under15_2020, r.under15_2025, r.change, pct(r.pctChange),
      ]),
    }),
  },

  "under5-metro-ranking": {
    id: "under5-metro-ranking",
    title: "St. Louis: 3rd-worst U.S. metro for the decline in young children",
    alt:
      "Among the 50 largest U.S. metros, St. Louis ranks 3rd-worst for the percentage decline in " +
      "children under 5 (2020–2025, −11.2%), behind only Los Angeles and San Jose.",
    source: DEMOGRAPHICS_SOURCE,
    hasExport: false,
    table: () => ({
      columns: ["Rank", "Metro", "Fewer children under 5", "% decline"],
      rows: rows(loadUnder5DeclineByMetro())
        .slice()
        .sort((a, b) => a.pctDecline - b.pctDecline)
        .slice(0, 12)
        // declineUnder5 is a signed change; show the magnitude under the "fewer" header
        // so the cell doesn't read as a double negative ("-18,267" under "decline").
        .map((r, i) => [i + 1, r.metro, Math.abs(r.declineUnder5), pct(r.pctDecline)]),
    }),
  },

  "stcharles-age-structure": {
    id: "stcharles-age-structure",
    title: "St. Charles County is aging: seniors now outnumber children",
    alt:
      "From 2020 to 2025 St. Charles County's under-15 share fell from 19% to 17% while the 65+ share " +
      "rose from 16% to 19% — most of the county's +21,233 growth was residents age 60 and older.",
    source: DEMOGRAPHICS_SOURCE,
    hasExport: false,
    table: () => ({
      columns: ["Age group", "2020", "2025", "Change"],
      rows: rows(loadStCharlesAgeStructure()).map((r) => [r.ageGroup, r.pop2020, r.pop2025, r.change]),
    }),
  },

  "aging-index-metro": {
    id: "aging-index-metro",
    title: "St. Louis ranks among the oldest large U.S. metros",
    alt:
      "St. Louis has the 9th-highest aging index among the 50 largest U.S. metros in 2025, with 20.1% " +
      "of residents age 65 and older.",
    source: DEMOGRAPHICS_SOURCE,
    hasExport: false,
    table: () => ({
      columns: ["Rank", "Metro", "Aging index 2025", "% 65+ (2025)"],
      rows: rows(loadAgingIndexByMetro())
        .slice()
        .sort((a, b) => b.agingIndex2025 - a.agingIndex2025)
        .slice(0, 12)
        .map((r, i) => [i + 1, r.metro, r.agingIndex2025.toFixed(1), `${r.pct65plus2025.toFixed(1)}%`]),
    }),
  },

  "msa-age-series": {
    id: "msa-age-series",
    title: "St. Louis MSA: fewer children, more seniors (2020–2025)",
    alt:
      "In the St. Louis metro, the youngest cohorts shrank (under-5 down 18,267 since 2020) while 65+ " +
      "cohorts grew — the under-5 group is now the smallest age band under 75.",
    source: DEMOGRAPHICS_SOURCE,
    hasExport: false,
    table: () => ({
      columns: ["Age group", "2020", "2025", "Change"],
      rows: rows(loadMsaPopulationByAge()).map((r) => [r.ageGroup, r.y2020, r.y2025, r.change]),
    }),
  },
};

export const CHART_IDS = Object.keys(CHARTS);
