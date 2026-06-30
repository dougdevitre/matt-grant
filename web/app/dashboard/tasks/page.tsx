import { getTasks, getVolunteers } from "@/lib/queries";
import { suggestVolunteers } from "@/lib/matching";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { addTask } from "@/app/dashboard/actions";
import { listTaskTemplates } from "@/lib/task-templates";
import { requireCap } from "@/lib/auth";
import { TaskBoard } from "@/components/dashboard/TaskBoard";

export default async function TasksPage() {
  await requireCap("manageTasks");
  const [{ connected, rows }, vols] = await Promise.all([getTasks(), getVolunteers()]);
  const volunteers = vols.rows;
  // Current task load per volunteer + best-fit suggestions for each open,
  // unassigned task (interest match + status + load-balance; see lib/matching).
  const loads: Record<string, number> = {};
  for (const t of rows) if (t.volunteerId) loads[t.volunteerId] = (loads[t.volunteerId] ?? 0) + 1;
  // Flatten to serializable suggestions for the client board.
  const suggestions: Record<string, { id: string; name: string; reasons: string[] }[]> = {};
  for (const t of rows) {
    if (!t.volunteerId && t.status !== "DONE") {
      suggestions[t.id] = suggestVolunteers(t, volunteers, loads, 3).map(({ v, fit }) => ({
        id: v.id, name: v.name, reasons: fit.reasons,
      }));
    }
  }
  const boardVolunteers = volunteers.map((v) => ({ id: v.id, name: v.name }));
  const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";
  const volOptions = volunteers.map((v) => (
    <option key={v.id} value={`${v.id}|${v.name}`}>{v.name}</option>
  ));
  // Airtable task-template library (read-only; [] when AIRTABLE_API_KEY unset),
  // grouped by dashboard category for the "start from a template" picker.
  const templates = await listTaskTemplates();
  const templatesByCat = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <>
      <PageHeader kicker="Operations" title="Task board" />

      {!connected && <DbNotice />}

      <HowTo
        steps={[
          "Add a task in the top bar: type a title, pick a category (Field, Finance, Comms, Compliance, Ops) and a priority, then click Add task.",
          "New tasks land in the To-do column; cards flow To do → In progress → Done.",
          "Move a card forward with “Start →” / “Done ✓”, or back with the ← button.",
          "HIGH-priority tasks show a red flag so the team can triage at a glance.",
          "The Overview page rolls these counts up into the task board summary.",
        ]}
      />

      <form action={addTask} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <input name="title" placeholder="New task… (or pick a template →)" className={`${input} min-w-[16rem] flex-1`} />
        <select name="category" aria-label="Task category" className={input} defaultValue="Field">
          {["Field", "Finance", "Comms", "Compliance", "Ops"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="priority" aria-label="Task priority" className={input} defaultValue="MEDIUM">
          {["HIGH", "MEDIUM", "LOW"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {templates.length > 0 && (
          <select name="template" aria-label="Start from a template" className={input} defaultValue="">
            <option value="">— or start from a template —</option>
            {Object.entries(templatesByCat).map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        <select name="volunteer" aria-label="Assign to volunteer" className={input} defaultValue="">
          <option value="">Unassigned</option>
          {volOptions}
        </select>
        <button type="submit" disabled={!connected} className="btn-ink disabled:opacity-50">Add task</button>
      </form>

      <TaskBoard rows={rows} volunteers={boardVolunteers} suggestions={suggestions} />
    </>
  );
}
