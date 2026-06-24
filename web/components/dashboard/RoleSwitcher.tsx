"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import { setViewAs, clearViewAs } from "@/app/dashboard/view-as";

// Admin-only control (rendered only when the real role is admin). Picking a lower
// role enters "view as" preview; picking Admin exits it. `current` is the
// effective role so the select reflects the active preview.
export function RoleSwitcher({ current }: { current: Role }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    start(async () => {
      if (next === "admin") await clearViewAs();
      else await setViewAs(next);
      router.refresh();
    });
  };

  return (
    <label className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
      <span className="hidden sm:inline">View as</span>
      <select
        value={current}
        onChange={onChange}
        disabled={pending}
        aria-label="Preview the dashboard as a role"
        className="rounded-sm border border-line bg-white px-2 py-1 text-xs normal-case tracking-normal text-ink disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r === "admin" ? "Admin (full access)" : ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </label>
  );
}
