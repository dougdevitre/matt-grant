"use client";

import { useActionState } from "react";
import { remindPendingInvitesAction, type InviteResult } from "@/app/dashboard/team/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

// Admin button: nudge still-pending Clerk invitees with a branded reminder.
// Bounded + de-duped server-side, so clicking again safely sends the next batch.
export function RemindPendingButton({ pending }: { pending: number }) {
  const [state, action] = useActionState<InviteResult | null, FormData>(remindPendingInvitesAction, null);
  return (
    <form action={action}>
      <SubmitButton
        pendingText="Sending reminders…"
        disabled={pending === 0}
        className="btn-ink disabled:opacity-50"
      >
        {pending > 0 ? `Remind pending invitees (${pending})` : "No pending invitations"}
      </SubmitButton>
      {state && <p className={`mt-2 text-sm ${state.ok ? "text-field" : "text-brick"}`}>{state.message}</p>}
    </form>
  );
}
