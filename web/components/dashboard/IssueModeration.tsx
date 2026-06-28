"use client";

import { useActionState, useState } from "react";
import {
  approveSubmission,
  rejectSubmission,
  editSubmission,
  removeSubmission,
  type ModerationResult,
} from "@/app/dashboard/issues/actions";

export type ModerationRow = {
  id: string;
  topic: string;
  details: string;
  status: string;
  name: string;
  city: string;
  email: string;
  phone: string;
  smsOptIn: boolean;
  submittedAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-slate-200 text-slate-600",
};

// One submission card. Each mutating control is its own form bound to a server action via
// useActionState, so a per-row result message renders inline without a full client refetch.
function Row({ row }: { row: ModerationRow }) {
  const [editing, setEditing] = useState(false);
  const [approve, approveAction, approving] = useActionState(approveSubmission, null);
  const [reject, rejectAction, rejecting] = useActionState(rejectSubmission, null);
  const [edit, editAction, savingEdit] = useActionState(editSubmission, null);
  const [del, delAction, deleting] = useActionState(removeSubmission, null);

  const msg: ModerationResult | null = del ?? edit ?? reject ?? approve;

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {editing ? null : <h3 className="font-medium text-ink">{row.topic}</h3>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_STYLE[row.status] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {row.status}
        </span>
      </div>

      {editing ? (
        <form action={editAction} className="space-y-2">
          <input type="hidden" name="id" value={row.id} />
          <input
            name="topic"
            defaultValue={row.topic}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Topic"
          />
          <textarea
            name="details"
            defaultValue={row.details}
            rows={3}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="Details (shown publicly once approved)"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={savingEdit} className="btn-ghost px-3 py-1 text-xs disabled:opacity-50">
              {savingEdit ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost px-3 py-1 text-xs">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        row.details && <p className="mb-3 whitespace-pre-wrap text-sm text-slate">{row.details}</p>
      )}

      <p className="mt-2 text-xs text-slate">
        {[row.name, row.city].filter(Boolean).join(" · ") || "Anonymous"}
        {row.email && <> · {row.email}</>}
        {row.phone && <> · {row.phone}</>}
        {row.smsOptIn && <> · SMS opt-in</>}
        {row.submittedAt && <> · {row.submittedAt}</>}
      </p>

      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.status !== "Approved" && (
            <form action={approveAction}>
              <input type="hidden" name="id" value={row.id} />
              <button disabled={approving} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50">
                {approving ? "…" : "Approve"}
              </button>
            </form>
          )}
          {row.status !== "Rejected" && (
            <form action={rejectAction}>
              <input type="hidden" name="id" value={row.id} />
              <button disabled={rejecting} className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-50">
                {rejecting ? "…" : "Reject"}
              </button>
            </form>
          )}
          <button onClick={() => setEditing(true)} className="btn-ghost px-2.5 py-1 text-xs">
            Edit
          </button>
          <form action={delAction}>
            <input type="hidden" name="id" value={row.id} />
            <button disabled={deleting} className="btn-ghost ml-auto px-2.5 py-1 text-xs text-red-600 disabled:opacity-50">
              {deleting ? "…" : "Delete"}
            </button>
          </form>
        </div>
      )}

      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.message}</p>
      )}
    </div>
  );
}

export function IssueModeration({ rows }: { rows: ModerationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-slate">
        No submissions yet. New topics from the public <span className="font-mono">/issues</span> form land
        here as <strong>Pending</strong>.
      </div>
    );
  }
  // Pending first (the queue that needs action), then Approved, then Rejected.
  const order: Record<string, number> = { Pending: 0, Approved: 1, Rejected: 2 };
  const sorted = [...rows].sort(
    (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.submittedAt.localeCompare(a.submittedAt),
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((r) => (
        <Row key={r.id} row={r} />
      ))}
    </div>
  );
}
