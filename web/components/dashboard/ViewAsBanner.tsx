"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/lib/rbac";
import { clearViewAs } from "@/app/dashboard/view-as";

// Persistent notice shown whenever an admin is previewing a lower role. The Exit
// button restores their real admin access. The server passes `role` in (the
// view-as cookie is httpOnly, so the client can't read it directly).
export function ViewAsBanner({ role }: { role: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const exit = () =>
    start(async () => {
      await clearViewAs();
      router.refresh();
    });

  return (
    <div
      role="status"
      className="mb-6 flex items-start justify-between gap-4 rounded-sm border border-gold/50 bg-gold/10 px-5 py-4 text-sm text-ink"
    >
      <p>
        <span className="font-semibold">Previewing as {ROLE_LABELS[role]}.</span>{" "}
        <span className="text-slate">
          You&apos;re seeing only what this role can — confidential surfaces they lack are hidden or blocked.
        </span>
      </p>
      <button
        type="button"
        onClick={exit}
        disabled={pending}
        className="shrink-0 rounded-sm border border-ink/30 bg-white px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-eyebrow text-ink hover:border-ink disabled:opacity-50"
      >
        {pending ? "Exiting…" : "Exit preview"}
      </button>
    </div>
  );
}
