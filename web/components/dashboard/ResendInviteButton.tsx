"use client";

import { useActionState } from "react";
import { resendInviteAction, type InviteResult } from "@/app/dashboard/team/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

// Per-row admin button: resend the invitation to ONE still-pending invitee. The
// email travels in a hidden field; feedback shows inline. Server-side it refuses
// anyone who already accepted, so it's safe even if the page data is a little stale.
export function ResendInviteButton({ email }: { email: string }) {
  const [state, action] = useActionState<InviteResult | null, FormData>(resendInviteAction, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <SubmitButton
        pendingText="Sending…"
        className="rounded-sm border border-line px-2.5 py-1 text-xs text-slate hover:border-ink hover:text-ink disabled:opacity-50"
      >
        Resend
      </SubmitButton>
      {state && <span className={`text-xs ${state.ok ? "text-field" : "text-brick"}`}>{state.message}</span>}
    </form>
  );
}
