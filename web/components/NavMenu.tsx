"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { NavGroup } from "@/lib/site";
import { mainHref } from "@/lib/site";

// Accessible desktop dropdown for one nav group. Opens on hover AND on
// keyboard/click (aria-expanded + aria-haspopup); closes on Escape, on
// click/focus outside, and after a child is chosen. The parent is "active"
// (gold underline) when the current route matches any child.
export function NavMenu({
  group,
  pathname,
  onSubdomain,
}: {
  group: NavGroup;
  pathname: string;
  onSubdomain: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const active = group.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));

  // Close on outside pointer/focus or Escape — only while open.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // Close when focus leaves the whole group (tabbing past the last child).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1 text-sm font-semibold transition-colors hover:text-ink ${
          active ? "text-ink" : "text-slate"
        }`}
      >
        {group.label}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {active && <span className="absolute -bottom-[26px] left-0 h-[3px] w-full bg-gold" />}
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute left-0 top-[calc(100%+18px)] z-50 min-w-[200px] rounded-sm border border-line bg-paper py-2 shadow-card"
        >
          {group.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
            return (
              <Link
                key={child.href}
                href={mainHref(child.href, onSubdomain)}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm font-semibold transition-colors hover:bg-line/40 hover:text-ink ${
                  childActive ? "text-ink" : "text-slate"
                }`}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
