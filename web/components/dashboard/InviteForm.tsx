"use client";

import { useActionState, useState } from "react";
import { inviteStaff, type InviteResult } from "@/app/dashboard/team/actions";
import { INVITABLE_ROLES, ROLE_LABELS, ROLE_BLURBS } from "@/lib/rbac";
import { looksExternal, type ExternalKind } from "@/lib/externalEmail";

const field = "w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-field";

const KIND_NOTE: Record<Exclude<ExternalKind, "">, string> = {
  "press/org": "a press / media / org address",
  "gov/mil": "a government or military address",
  "role-addr": "a role inbox (not a person)",
};

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteResult | null, FormData>(inviteStaff, null);
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const ext = looksExternal(email);
  const blockedUntilConfirm = !!ext && !confirmed;

  return (
    <form action={action} className="card p-6">
      <p className="eyebrow text-brick">Invite a teammate</p>
      <p className="mt-1 text-sm text-slate">They get a Clerk invitation email and their role is set when they accept — works even with sign-up locked to invitation-only. <strong>An invite grants internal dashboard access at the chosen role</strong> once they sign up.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto]">
        <input name="name" placeholder="Name (optional)" className={field} />
        <input
          name="email"
          type="email"
          required
          placeholder="teammate@email.com"
          className={field}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select name="role" defaultValue="volunteer" className={field} title="Access level" aria-label="Access level">
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button type="submit" disabled={pending || blockedUntilConfirm} className="btn-primary disabled:opacity-60">{pending ? "Inviting…" : "Send invite"}</button>
      </div>
      {ext && (
        <label className="mt-3 flex items-start gap-2 rounded-sm border border-gold/50 bg-gold/10 px-3 py-2 text-xs text-[#7a5a12]">
          <input type="checkbox" name="confirmExternal" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span><strong>Heads up:</strong> <span className="font-mono">{email.split("@")[1]}</span> looks like {KIND_NOTE[ext]}. Inviting them grants <strong>internal dashboard access</strong> at the selected role once they sign up. Check this box to confirm that's intended.</span>
        </label>
      )}
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
