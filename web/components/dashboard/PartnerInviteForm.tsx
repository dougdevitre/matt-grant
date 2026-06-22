"use client";

import { useActionState } from "react";
import { invitePartner, type InviteResult } from "@/app/dashboard/team/actions";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";

// Coalition-partner invite — the Peace Room flow. No role picker: every invite
// here is a `partner`, who can reach ONLY the shared Peace Room (no donors,
// finance, compliance, or internal campaign data). Kept distinct from the staff
// InviteForm so an external partner is never confused with internal access.
export function PartnerInviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(invitePartner, null);
  return (
    <form action={action} className="card p-6">
      <p className="eyebrow text-brick">Invite a coalition partner</p>
      <p className="mt-1 text-sm text-slate">
        Allied candidates and partners who join the shared <strong>Peace Room</strong> to make the case for
        change together. They see the shared board and nothing else.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
        <input name="name" placeholder="Name (optional)" className={field} />
        <input name="email" type="email" required placeholder="partner@email.com" className={field} />
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">{pending ? "Inviting…" : "Invite partner"}</button>
      </div>
      <p className="mt-2 text-xs text-slate">
        Partners get the <strong>Peace Room only</strong> — no access to donors, finance, compliance, or
        internal campaign tools.
      </p>
      {state && (
        <p className={`mt-3 rounded-sm border px-3 py-2 text-sm ${state.ok ? "border-field/40 bg-field/10 text-field" : "border-brick/40 bg-brick/10 text-brick"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
