// Advanced search/filter/sort config for the dashboard Task board. The board still
// groups results into the To do / In progress / Done columns by status, so there's
// no status facet here — these facets/sorts narrow and order cards within columns.
import type { TaskRow } from "@/lib/queries";
import type { TableConfig, TableCtx } from "./types";
import { classifyDue, dueSortKey } from "@/lib/dashboard/due";

// Due facets/sort need "today" (YYYY-MM-DD) — supplied via ctx by the board so the
// pure config stays free of Date.now.
export type TaskCtx = { today: string };
const today = (ctx: TableCtx) => (ctx as TaskCtx).today ?? "";

const priorityRank = (p: string) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 } as Record<string, number>)[p] ?? 9;
const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();

export const TASK_TABLE: TableConfig<TaskRow> = {
  id: "tasks",
  search: (t) => [t.title, t.detail, t.category, t.volunteerName].filter(Boolean).join(" "),
  facets: [
    {
      key: "category",
      label: "Category",
      type: "select",
      options: (rows) => uniq(rows.map((r) => r.category)).map((v) => ({ value: v, label: v })),
      match: (t, sel) => (sel as string[]).includes(t.category),
    },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: () => ["HIGH", "MEDIUM", "LOW"].map((v) => ({ value: v, label: v })),
      match: (t, sel) => (sel as string[]).includes(t.priority),
    },
    { key: "unassigned", label: "Unassigned", type: "boolean", match: (t) => !t.volunteerId },
    { key: "overdue", label: "Overdue", type: "boolean", match: (t, _s, ctx) => classifyDue(t.dueDate, today(ctx)).state === "overdue" },
    { key: "dueToday", label: "Due today", type: "boolean", match: (t, _s, ctx) => classifyDue(t.dueDate, today(ctx)).state === "today" },
    {
      key: "dueWeek",
      label: "Due this week",
      type: "boolean",
      match: (t, _s, ctx) => ["overdue", "today", "soon"].includes(classifyDue(t.dueDate, today(ctx)).state),
    },
  ],
  sorts: [
    { key: "priority", label: "Priority", compare: (a, b) => priorityRank(a.priority) - priorityRank(b.priority) },
    { key: "due", label: "Due date", compare: (a, b) => dueSortKey(a.dueDate) - dueSortKey(b.dueDate) },
    { key: "title", label: "Title", compare: (a, b) => a.title.localeCompare(b.title) },
  ],
  defaultSort: { key: "priority", dir: "asc" },
  presets: [
    { name: "High priority", state: { facets: { priority: ["HIGH"] } } },
    { name: "Overdue", state: { facets: { overdue: true }, sort: "due", dir: "asc" } },
    { name: "Due this week", state: { facets: { dueWeek: true }, sort: "due", dir: "asc" } },
    { name: "Unassigned", state: { facets: { unassigned: true } } },
  ],
};
