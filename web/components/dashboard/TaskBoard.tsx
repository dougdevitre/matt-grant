"use client";

import { useMemo, useState } from "react";
import type { TaskRow } from "@/lib/queries";
import { setTaskStatus, setTaskVolunteer, setTaskDueDate } from "@/app/dashboard/actions";
import { DataToolbar } from "@/components/dashboard/DataToolbar";
import { useTableQuery } from "@/components/dashboard/useTableQuery";
import { TASK_TABLE, type TaskCtx } from "@/lib/table/tasks-config";
import { classifyDue } from "@/lib/dashboard/due";

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

const dueCls: Record<string, string> = {
  overdue: "bg-brick/10 text-brick",
  today: "bg-gold/15 text-ink",
  soon: "bg-field/10 text-field",
  later: "bg-ink/5 text-slate",
};

type Suggestion = { id: string; name: string; reasons: string[] };

// The kanban task board, now a client component so the shared DataToolbar can
// search/filter/sort cards across the columns. Server actions (status + assignment)
// still run via form posts; suggestions are precomputed server-side and passed in.
export function TaskBoard({
  rows,
  volunteers,
  suggestions,
}: {
  rows: TaskRow[];
  volunteers: { id: string; name: string }[];
  suggestions: Record<string, Suggestion[]>;
}) {
  // "today" (YYYY-MM-DD) captured once at mount — lazy init keeps render pure for
  // the React Compiler (no Date.now during render/useMemo).
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const ctx = useMemo<TaskCtx>(() => ({ today }), [today]);
  const { state, setState, filtered } = useTableQuery(rows, TASK_TABLE, ctx);
  const volOptions = useMemo(
    () => volunteers.map((v) => <option key={v.id} value={`${v.id}|${v.name}`}>{v.name}</option>),
    [volunteers],
  );

  return (
    <>
      <div className="mb-4">
        <DataToolbar cfg={TASK_TABLE} rows={rows} state={state} setState={setState} ctx={ctx} shown={filtered.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const tasks = filtered.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-lg border border-line bg-paper/60 p-3">
              <div className="flex items-center justify-between px-2 py-2">
                <h2 className="font-mono text-xs uppercase tracking-eyebrow text-slate">{col.label}</h2>
                <span className="font-mono text-xs text-slate">{tasks.length}</span>
              </div>
              <div className="space-y-3">
                {tasks.map((t) => {
                  const due = classifyDue(t.dueDate, today);
                  return (
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
                    {due.state !== "none" && t.status !== "DONE" && (
                      <span className={`mt-1 inline-block rounded-sm px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-eyebrow ${dueCls[due.state]}`}>
                        {due.label}
                      </span>
                    )}
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
                    {suggestions[t.id]?.length ? (
                      <div className="mt-2">
                        <p className="font-mono text-[0.55rem] uppercase tracking-eyebrow text-slate">Suggested</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {suggestions[t.id].map((v) => (
                            <form key={v.id} action={setTaskVolunteer}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="volunteer" value={`${v.id}|${v.name}`} />
                              <button
                                title={v.reasons.join(" · ")}
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
                    <form action={setTaskDueDate} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <input
                        type="date"
                        name="dueDate"
                        defaultValue={t.dueDate ?? ""}
                        aria-label={`Due date for ${t.title}`}
                        className="min-w-0 flex-1 rounded-sm border border-line bg-white px-2 py-1 text-xs text-ink"
                      />
                      <button className="btn-ghost px-2 py-1 text-xs">Set due</button>
                    </form>
                  </div>
                  );
                })}
                {tasks.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
