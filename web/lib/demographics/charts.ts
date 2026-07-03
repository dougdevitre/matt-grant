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
import type { ChartSpec } from "@/lib/viz/chart";
import { BRAND } from "@/lib/viz/palette";

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
  /**
   * Optional in-app chart geometry. When present, <Figure> renders an inline SVG
   * (lib/viz + BarChart) from the same validated rows as table(), so a visual ships
   * with no Datawrapper export step. The SVG is decorative; table() stays the a11y
   * text alternative. Omit to fall back to Datawrapper-SVG-or-table.
   */
  chart?: () => ChartSpec;
  /** Left-gutter width override (chart units) for long category labels. */
  chartGutter?: number;
};

const rows = <T,>(r: { ok: boolean; data: T[] | null }): T[] => (r.ok && r.data ? r.data : []);
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
// Metro names are long ("Los Angeles-Long Beach-Anaheim, CA"); the bar's left gutter
// shows just the primary city. The full name stays in the data table.
const shortMetro = (m: string) => m.split(/[-,]/)[0].trim();
const noAge = (g: string) => g.replace(/^Age\s*/, "");

export const CHARTS: Record<string, ChartDef> = {
  "mo02-child-under15": {
    id: "mo02-child-under15",
    title: "Children under 15 are declining across MO-02",
    alt:
      "Children under 15 fell across MO-02's core counties from 2020 to 2025: St. Louis County −5.9% " +
      "and Jefferson County −5.6%. These are the two MO-02 counties in the St. Louis MSA dataset; the " +
      "district's three rural counties (Washington, Crawford, Gasconade) are outside this dataset, and " +
      "MO-02 includes only the western/central part of St. Louis County.",
    source: DEMOGRAPHICS_SOURCE,
    hasExport: false,
    table: () => ({
      columns: ["County", "2020", "2025", "Change", "% change"],
      rows: mo02Counties(rows(loadChildUnder15ByCounty())).map((r) => [
        r.county, r.under15_2020, r.under15_2025, r.change, pct(r.pctChange),
      ]),
    }),
    chart: () => ({
      kind: "bars",
      colorMode: "diverging",
      bars: mo02Counties(rows(loadChildUnder15ByCounty())).map((r) => ({
        label: r.county.replace(" County", ""),
        value: r.pctChange,
        display: pct(r.pctChange),
      })),
    }),
    chartGutter: 130,
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
    chart: () => ({
      kind: "bars",
      colorMode: "highlight",
      // Rank by steepest decline; plot the magnitude so all bars read the same
      // direction, and highlight St. Louis. The signed % is the value label.
      bars: rows(loadUnder5DeclineByMetro())
        .slice()
        .sort((a, b) => a.pctDecline - b.pctDecline)
        .slice(0, 12)
        .map((r) => ({
          label: shortMetro(r.metro),
          value: Math.abs(r.pctDecline),
          display: pct(r.pctDecline),
          highlight: r.metro.includes("St. Louis"),
        })),
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
    chart: () => ({
      kind: "grouped",
      series: [
        { name: "2020", color: "#B7C0CC" },
        { name: "2025", color: BRAND.field },
      ],
      groups: rows(loadStCharlesAgeStructure())
        .filter((r) => r.ageGroup !== "Total")
        .map((r) => ({ label: noAge(r.ageGroup), values: [r.pop2020, r.pop2025] })),
    }),
    chartGutter: 92,
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
    chart: () => ({
      kind: "bars",
      colorMode: "highlight",
      bars: rows(loadAgingIndexByMetro())
        .slice()
        .sort((a, b) => b.agingIndex2025 - a.agingIndex2025)
        .slice(0, 12)
        .map((r) => ({
          label: shortMetro(r.metro),
          value: r.agingIndex2025,
          display: r.agingIndex2025.toFixed(1),
          highlight: r.metro.includes("St. Louis"),
        })),
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
    chart: () => ({
      kind: "bars",
      colorMode: "diverging",
      // Net change per age band (2025 − 2020): youngest cohorts shrink (brick),
      // oldest grow (blue), around a zero baseline.
      bars: rows(loadMsaPopulationByAge())
        .filter((r) => r.ageGroup !== "Total")
        .map((r) => ({ label: noAge(r.ageGroup), value: r.y2025 - r.y2020, display: signed(r.y2025 - r.y2020) })),
    }),
    chartGutter: 92,
  },
};

export const CHART_IDS = Object.keys(CHARTS);
