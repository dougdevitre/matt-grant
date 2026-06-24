"use client";

import { useId, useState } from "react";

// Small accessible "?" affordance for explaining campaign/FEC jargon in plain
// language. Opens on hover, keyboard focus, or click; the popover is a
// role="tooltip" referenced via aria-describedby so it passes the axe a11y check.
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block align-middle leading-none">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="ml-1 grid h-4 w-4 place-items-center rounded-full border border-slate text-[0.6rem] font-bold text-slate transition-colors hover:border-ink hover:text-ink focus-visible:border-ink focus-visible:text-ink"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-sm border border-line bg-white p-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-ink shadow-card"
        >
          {children}
        </span>
      )}
    </span>
  );
}
