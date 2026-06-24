"use client";

import { useActionState } from "react";
import { inviteStaff, type InviteResult } from "@/app/dashboard/team/actions";
import { INVITABLE_ROLES, ROLE_LABELS, ROLE_BLURBS } from "@/lib/rbac";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteStaff, null);
  return (
    <form action={action} className="card p-6">
      <p className="eyebrow text-brick">Invite a teammate</p>
      <p className="mt-1 text-sm text-slate">They get a Clerk invitation email and their role is set when they accept — works even with sign-up locked to invitation-only.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
        <input name="name" placeholder="Name (optional)" className={field} />
        <input name="email" type="email" required placeholder="teammate@email.com" className={field} />
        <select name="role" defaultValue="volunteer" className={field} title="Access level" aria-label="Access level">
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Inviting…" : "Send invite"}</button>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-slate">
        {INVITABLE_ROLES.map((r) => (
          <li key={r}><strong>{ROLE_LABELS[r]}</strong> — {ROLE_BLURBS[r]}</li>
        ))}
      </ul>
      {state && (
        <p className={`mt-3 rounded-sm border px-3 py-2 text-sm ${state.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
