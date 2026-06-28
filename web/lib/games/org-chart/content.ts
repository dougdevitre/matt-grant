import raw from "@/content/games/org-chart.json";
import { GameContentSchema, type GameContent } from "@/lib/games/content-schema";
import { OrgChartConfigSchema, type OrgChartConfig } from "./config.schema";
import { makeOrgChart } from "./reducer";

// Validate on import so a malformed edit fails fast (and content-lint catches it in CI).
export const orgChartContent: GameContent = GameContentSchema.parse((raw as { copy: unknown }).copy);
export const orgChartConfig: OrgChartConfig = OrgChartConfigSchema.parse((raw as { config: unknown }).config);

/** Build a fresh, config-bound Org Chart game instance. */
export const buildOrgChart = () => makeOrgChart(orgChartConfig);
