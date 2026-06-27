// Dashboard bridge to the Airtable "Task Templates" library (the ~90 reusable
// campaign tasks). When AIRTABLE_API_KEY is set, the task board's "Add task" form
// can start from a template — pre-filling title, category, priority, and a detail
// line carrying the template's mode / geo / effort / channel so the matcher and
// the assigned volunteer get real context. Read-only; returns [] when the token
// is unset (the form just omits the picker). Base/table from the central registry.
import { getSecret } from "@/lib/ssm";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const BASE_ID = AIRTABLE_BASES.volunteer.id;
const TABLE_ID = AIRTABLE_BASES.volunteer.tables.taskTemplates;

type Category = "Field" | "Finance" | "Comms" | "Compliance" | "Ops";

export type TaskTemplate = {
  id: string;
  name: string;
  category: Category;
  priority: "HIGH" | "MEDIUM" | "LOW";
  detail: string;
};

type AirtableRecord = { id: string; fields: Record<string, unknown> };

const toArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

// Map the template's channels to a dashboard task category.
function categoryFor(channels: string[]): Category {
  const c = channels.join(" ").toLowerCase();
  if (c.includes("donate")) return "Finance";
  if (/social|email|writing/.test(c)) return "Comms";
  if (/data/.test(c)) return "Ops";
  return "Field";
}

function priorityFor(p: unknown): TaskTemplate["priority"] {
  const s = String(p ?? "").toLowerCase();
  return s === "high" ? "HIGH" : s === "low" ? "LOW" : "MEDIUM";
}

function recordToTemplate(rec: AirtableRecord): TaskTemplate | null {
  const f = rec.fields;
  const name = String(f["Task Name"] ?? "").trim();
  if (!name || String(f["Status"] ?? "") === "Archived") return null;
  const channels = toArr(f["Channel"]);
  const mode = String(f["Participation Mode"] ?? "").trim();
  const geo = String(f["Geo Scope"] ?? "").trim();
  const effort = String(f["Effort"] ?? "").trim();
  const pass = String(f["Contact Pass Type"] ?? "").trim();
  const script = String(f["Script / Talking Points"] ?? "").trim();
  const ctx = [
    mode,
    geo && `geo: ${geo}`,
    effort,
    channels.length ? channels.join("/") : null,
    pass && !pass.startsWith("N/A") ? `pass: ${pass}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const detail = [String(f["What They Do"] ?? "").trim(), ctx && `[${ctx}]`, script && `Script: ${script}`]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 3500);
  return { id: rec.id, name, category: categoryFor(channels), priority: priorityFor(f["Priority"]), detail };
}

async function fetchAll(): Promise<AirtableRecord[]> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return [];
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  try {
    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
      url.searchParams.set("pageSize", "100");
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, next: { revalidate: 900 } });
      if (!res.ok) break;
      const data = (await res.json()) as { records?: AirtableRecord[]; offset?: string };
      out.push(...(data.records ?? []));
      offset = data.offset;
    } while (offset);
  } catch {
    return out;
  }
  return out;
}

/** All non-archived templates, sorted by category then name. [] when unconfigured. */
export async function listTaskTemplates(): Promise<TaskTemplate[]> {
  return (await fetchAll())
    .map(recordToTemplate)
    .filter((t): t is TaskTemplate => t != null)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** Single template by Airtable record id — for the addTask action. */
export async function getTaskTemplate(id: string): Promise<TaskTemplate | null> {
  if (!id) return null;
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const rec = (await res.json()) as AirtableRecord;
    return rec?.id ? recordToTemplate(rec) : null;
  } catch {
    return null;
  }
}
