import { getTasks, getVolunteers } from "@/lib/queries";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { addTask, setTaskStatus, setTaskVolunteer } from "@/app/dashboard/actions";

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
  const [{ connected, rows }, vols] = await Promise.all([getTasks(), getVolunteers()]);
  const volunteers = vols.rows;
  const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";
  const volOptions = volunteers.map((v) => (
    <option key={v.id} value={`${v.id}|${v.name}`}>{v.name}</option>
  ));

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
        <input name="title" required placeholder="New task…" className={`${input} min-w-[16rem] flex-1`} />
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
