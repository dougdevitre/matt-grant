"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// A submit button that reflects its form's pending state — disabled + a "working"
// label while the server action runs. Uses useFormStatus, so it works inside any
// `<form action={serverAction}>` with NO change to the action itself (the form's
// revalidation then refreshes the visible data). `disabled` ORs with pending.
export function SubmitButton({
  children,
  pendingText = "Working…",
  className,
  disabled,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
