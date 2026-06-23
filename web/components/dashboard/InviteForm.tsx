"use client";

import { useActionState } from "react";
import { inviteStaff, type InviteResult } from "@/app/dashboard/team/actions";

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
        <select name="role" defaultValue="member" className={field} title="Access level" aria-label="Access level">
          <option value="member">Member</option>
          <option value="captain">Captain</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Inviting…" : "Send invite"}</button>
      </div>
      <p className="mt-2 text-xs text-slate">
        <strong>Members</strong> get field, volunteers, tasks, and graphics. <strong>Captains</strong> add precinct targets, research, the plan, and read-only finance &amp; donor totals. <strong>Admins</strong> add full finance, donors, compliance, email sends, and team management.
      </p>
      {state && (
        <p className={`mt-3 rounded-sm border px-3 py-2 text-sm ${state.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
