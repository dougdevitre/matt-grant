// AI campaign-strategy engine. Calls Claude to produce a "responsible governance"
// brief + a localized action plan for one of the four documented priorities, and
// degrades gracefully to a curated, platform-faithful plan when the key is absent
// or the call fails (mirrors web/app/api/press/topics/route.ts). Never throws.
import { getSecret } from "@/lib/ssm";
import { ISSUES, getIssue, type Issue } from "@/lib/issues";
import { buildAgenda, type AgendaDay, type Cadence } from "@/lib/actions";
import { CAMPAIGN } from "@/lib/site";
import { SYSTEM, userMessage, LEVELS, LEVEL_LABEL, type Level, type Depth } from "./prompt";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

export const STRATEGY_DISCLAIMER = `For education and civic engagement only — not legal advice. ${CAMPAIGN.paidForBy}`;

export type StrategyInput = {
  issueSlug?: string;
  area?: string;
  level?: string;
  cadence?: string;
  depth?: string;
};

export type StrategyResult = {
  source: "ai" | "curated";
  issueSlug: string;
  issueTitle: string;
  issueEyebrow: string;
  area: string;
  level: Level;
  cadence: Cadence;
  depth: Depth;
  brief: string[];
  actions: AgendaDay[];
  disclaimer: string;
};

// Coerce untrusted input to safe, known values.
export function normalize(input: StrategyInput) {
  const issue = getIssue(String(input.issueSlug ?? "")) ?? ISSUES[0];
  const area = (String(input.area ?? "").trim() || "your area").slice(0, 80);
  const level: Level = LEVELS.includes(input.level as Level) ? (input.level as Level) : "city";
  const cadence: Cadence = input.cadence === "daily" ? "daily" : "weekly";
  const depth: Depth = input.depth === "full" ? "full" : "public";
  return { issue, area, level, cadence, depth };
}

// Only allow internal paths or the campaign's own https origin for AI-supplied
// links — neutralizes javascript:/data: and off-site URLs.
export function safeHref(h: unknown): string | undefined {
  if (typeof h !== "string") return undefined;
  const t = h.trim();
  if (/^\/(?!\/)/.test(t)) return t;
  if (/^https:\/\/(www\.)?mattgrantforcongress\.org(\/|$)/i.test(t)) return t;
  return undefined;
}

// Validate + clamp a model JSON response. Returns null when unusable.
export function parseStrategy(text: string): { brief: string[]; actions: AgendaDay[] } | null {
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s < 0 || e <= s) return null;
    const json = JSON.parse(text.slice(s, e + 1));
    const brief: string[] = Array.isArray(json?.brief)
      ? json.brief.filter((p: unknown) => typeof p === "string" && p.trim()).map((p: string) => p.trim()).slice(0, 6)
      : [];
    const actions: AgendaDay[] = (Array.isArray(json?.actions) ? json.actions : [])
      .slice(0, 7)
      .map((d: Record<string, unknown>) => ({
        label: (String(d?.label ?? "").trim() || "Day").slice(0, 40),
        theme: String(d?.theme ?? "").trim().slice(0, 120),
        items: (Array.isArray(d?.items) ? d.items : [])
          .slice(0, 6)
          .map((it: Record<string, unknown>) => ({
            text: String(it?.text ?? "").trim().slice(0, 300),
            tag: (String(it?.tag ?? "").trim() || "Action").slice(0, 28),
            href: safeHref(it?.href),
          }))
          .filter((it: { text: string }) => it.text),
      }))
      .filter((d: AgendaDay) => d.items.length);
    if (!brief.length || !actions.length) return null;
    return { brief, actions };
  } catch {
    return null;
  }
}

function curatedBrief(issue: Issue, level: Level, depth: Depth): string[] {
  if (depth === "public") return [issue.argument];
  const paras = [issue.argument, issue.signature?.body ?? issue.commitment];
  paras.push(
    `At the ${LEVEL_LABEL[level]} level, the most responsible step is to inform your neighbors, show up to public meetings, and turn out the vote on ${CAMPAIGN.electionLabel}.`,
  );
  return paras;
}

function curatedActions(area: string, slug: string, cadence: Cadence, depth: Depth): AgendaDay[] {
  const days = buildAgenda(area, slug, cadence).days;
  return depth === "public" && cadence === "weekly" ? days.slice(0, 3) : days;
}

// The platform-faithful fallback — also the no-key path. Pure (no network).
export function buildCurated(input: StrategyInput): StrategyResult {
  const { issue, area, level, cadence, depth } = normalize(input);
  return {
    source: "curated",
    issueSlug: issue.slug,
    issueTitle: issue.title,
    issueEyebrow: issue.eyebrow,
    area,
    level,
    cadence,
    depth,
    brief: curatedBrief(issue, level, depth),
    actions: curatedActions(area, issue.slug, cadence, depth),
    disclaimer: STRATEGY_DISCLAIMER,
  };
}

export async function generateStrategy(input: StrategyInput): Promise<StrategyResult> {
  const { issue, area, level, cadence, depth } = normalize(input);
  const curated = buildCurated(input);

  const KEY = (await getSecret("ANTHROPIC_API_KEY")) || process.env.MATT_GRANT_ANTHROPIC_API_KEY || "";
  if (!KEY) return curated;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: depth === "full" ? 1600 : 700,
        system: SYSTEM,
        messages: [{ role: "user", content: userMessage({ issue, area, level, cadence, depth }) }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return curated;
    const data = await res.json();
    const parsed = parseStrategy(data?.content?.[0]?.text ?? "");
    if (!parsed) return curated;
    return { ...curated, source: "ai", brief: parsed.brief, actions: parsed.actions };
  } catch {
    return curated; // timeout / bad JSON / network — never 500 the page
  }
}
