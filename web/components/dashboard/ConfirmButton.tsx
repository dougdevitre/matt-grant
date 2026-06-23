"use client";

import type { ReactNode } from "react";

// A submit button that asks for confirmation before letting its <form> submit.
// Drop into any server-rendered `<form action={serverAction}>` to guard a
// destructive / irreversible action — cancelling the dialog preventDefaults the
// submit, so the server action never runs. Supports `formAction`/`name`/`value`
// for multi-button forms (e.g. the social connections panel).
export function ConfirmButton({
  message,
  children,
  className,
  formAction,
  name,
  value,
  "aria-label": ariaLabel,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      name={name}
      value={value}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
