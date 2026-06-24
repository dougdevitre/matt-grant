// Pure helpers for the Data hub status board — kept out of the React components so
// they're unit-testable. previewOf() summarizes any source payload to a few labels;
// summarize() rolls per-source status into header counts; remedyFor() derives the fix.
import type { SourceEntry } from "./registry";

/** The resolved status of one source on the hub. */
export type HubKind = "live" | "degraded" | "error" | "configured" | "unconfigured" | "idle";

function labelOfProps(props: Record<string, unknown> | undefined): string | null {
  if (!props) return null;
  for (const k of ["name", "label", "title", "item", "Precinct", "NAME"]) {
    if (typeof props[k] === "string" && props[k]) return props[k] as string;
  }
  return null;
}

function labelOfItem(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") return labelOfProps(item as Record<string, unknown>);
  return null;
}

/**
 * Up to `limit` short labels from any source payload — a FeatureCollection (feature
 * names), an array (item labels), or a wrapped object (its first array field). Used
 * for the inline preview so staff can see a source returns what they expect.
 */
export function previewOf(data: unknown, limit = 3): string[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.slice(0, limit).map((it, i) => labelOfItem(it) ?? `item ${i + 1}`);
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.features)) {
      return (obj.features as Array<{ properties?: Record<string, unknown> }>)
        .slice(0, limit)
        .map((f, i) => labelOfProps(f?.properties) ?? `feature ${i + 1}`);
    }
    for (const key of ["bills", "candidates", "items", "rows"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).slice(0, limit).map((it, i) => labelOfItem(it) ?? `${key} ${i + 1}`);
      }
    }
    return Object.keys(obj).slice(0, limit);
  }
  return [String(data)];
}

export type HubCounts = {
  live: number;
  degraded: number;
  error: number;
  configured: number;
  unconfigured: number;
  idle: number;
  total: number;
};

/** Roll per-source kinds into the header counts. */
export function summarize(kinds: HubKind[]): HubCounts {
  const counts: HubCounts = { live: 0, degraded: 0, error: 0, configured: 0, unconfigured: 0, idle: 0, total: kinds.length };
  for (const k of kinds) counts[k]++;
  return counts;
}

export type Remedy = { label: string; hint: string };

/** The concrete fix for a source in a bad state, or null when nothing to do. */
export function remedyFor(entry: SourceEntry, kind: HubKind): Remedy | null {
  if (kind === "unconfigured") {
    return {
      label: "Configure",
      hint: entry.enabledEnv?.length ? `Set ${entry.enabledEnv.join(", ")} (see web/.env.example)` : "Add credentials",
    };
  }
  if (kind === "degraded" || kind === "error") {
    if (entry.kind === "csv" && entry.regen) return { label: "Regenerate", hint: entry.regen };
    if (entry.remedy) return { label: "Fix", hint: entry.remedy };
    if (entry.enabledEnv?.length) return { label: "Configure", hint: `Set ${entry.enabledEnv.join(", ")}` };
    if (entry.kind === "geo") return { label: "Upstream", hint: "Upstream unavailable — showing sample data" };
  }
  return null;
}
