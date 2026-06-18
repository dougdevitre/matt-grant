"use client";

import { useActionState } from "react";
import { inviteStaff, type InviteResult } from "@/app/dashboard/team/actions";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteStaff, null);
  return (
    <form action={action} className="card p-6">
      <p className="eyebrow text-brick">Invite a teammate</p>
      <p className="mt-1 text-sm text-slate">They'll be able to sign in immediately — no redeploy. We'll email them a link.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
        <input name="name" placeholder="Name (optional)" className={field} />
        <input name="email" type="email" required placeholder="teammate@email.com" className={field} />
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Inviting…" : "Send invite"}</button>
      </div>
      {state && (
        <p className={`mt-3 rounded-sm border px-3 py-2 text-sm ${state.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
