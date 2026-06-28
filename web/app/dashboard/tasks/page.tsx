import { getTasks, getVolunteers } from "@/lib/queries";
import { suggestVolunteers } from "@/lib/matching";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { addTask, setTaskStatus, setTaskVolunteer } from "@/app/dashboard/actions";
import { listTaskTemplates } from "@/lib/task-templates";
import { requireCap } from "@/lib/auth";

const COLUMNS = [
  { key: "TODO", label: "To do", next: "DOING", nextLabel: "Start →" },
  { key: "DOING", label: "In progress", next: "DONE", nextLabel: "Done ✓", prev: "TODO" },
  { key: "DONE", label: "Done", prev: "DOING" },
] as const;

const catColor: Record<string, string> = {
  Field: "text-field",
  Finance: "text-brick",
  Comms: "text-[#9a6f1a]",
  Compliance: "text-ink",
  Ops: "text-slate",
};

export default async function TasksPage() {
  await requireCap("manageTasks");
  const [{ connected, rows }, vols] = await Promise.all([getTasks(), getVolunteers()]);
  const volunteers = vols.rows;
  // Current task load per volunteer + best-fit suggestions for each open,
  // unassigned task (interest match + status + load-balance; see lib/matching).
  const loads: Record<string, number> = {};
  for (const t of rows) if (t.volunteerId) loads[t.volunteerId] = (loads[t.volunteerId] ?? 0) + 1;
  const suggestionsByTask: Record<string, ReturnType<typeof suggestVolunteers>> = {};
  for (const t of rows) {
    if (!t.volunteerId && t.status !== "DONE") suggestionsByTask[t.id] = suggestVolunteers(t, volunteers, loads, 3);
  }
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

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const tasks = rows.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-lg border border-line bg-paper/60 p-3">
              <div className="flex items-center justify-between px-2 py-2">
                <h2 className="font-mono text-xs uppercase tracking-eyebrow text-slate">{col.label}</h2>
                <span className="font-mono text-xs text-slate">{tasks.length}</span>
              </div>
              <div className="space-y-3">
                {tasks.map((t) => (
                  <div key={t.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[0.6rem] uppercase tracking-eyebrow ${catColor[t.category] ?? "text-slate"}`}>
                        {t.category}
                      </span>
                      {t.priority === "HIGH" && (
                        <span className="font-mono text-[0.6rem] uppercase text-brick">high</span>
                      )}
                    </div>
                    <p className={`mt-2 text-sm font-semibold ${t.status === "DONE" ? "text-slate line-through" : "text-ink"}`}>
                      {t.title}
                    </p>
                    {t.volunteerName && <p className="mt-1 text-xs text-field">👤 {t.volunteerName}</p>}
                    <div className="mt-3 flex gap-2">
                      {"prev" in col && col.prev && (
                        <form action={setTaskStatus}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={col.prev} />
                          <button className="btn-ghost px-2.5 py-1 text-xs">←</button>
                        </form>
                      )}
                      {"next" in col && col.next && (
                        <form action={setTaskStatus}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={col.next} />
                          <button className="btn-ghost px-2.5 py-1 text-xs">{col.nextLabel}</button>
                        </form>
                      )}
                    </div>
                    {suggestionsByTask[t.id]?.length ? (
                      <div className="mt-2">
                        <p className="font-mono text-[0.55rem] uppercase tracking-eyebrow text-slate">Suggested</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {suggestionsByTask[t.id].map(({ v, fit }) => (
                            <form key={v.id} action={setTaskVolunteer}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="volunteer" value={`${v.id}|${v.name}`} />
                              <button
                                title={fit.reasons.join(" · ")}
                                className="rounded-full border border-field/40 bg-field/5 px-2 py-0.5 text-[0.65rem] text-field hover:bg-field/15"
                              >
                                + {v.name}
                              </button>
                            </form>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <form action={setTaskVolunteer} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <select
                        name="volunteer"
                        aria-label="Assign task to volunteer"
                        defaultValue={t.volunteerId ? `${t.volunteerId}|${t.volunteerName ?? ""}` : ""}
                        className="min-w-0 flex-1 rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink"
                      >
                        <option value="">Unassigned</option>
                        {volOptions}
                      </select>
                      <button className="btn-ghost px-2 py-1 text-xs">Assign</button>
                    </form>
                  </div>
                ))}
                {tasks.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
