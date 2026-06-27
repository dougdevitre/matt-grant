"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { NavGroup } from "@/lib/site";
import { mainHref } from "@/lib/site";
import { ctaThumbForHref } from "@/lib/cta-images";
import { CtaThumb } from "@/components/CtaThumb";
import { NavIcon } from "@/components/NavIcon";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<null | "first" | "last">(null);
  const menuId = useId();

  const active = group.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));

  const links = () => Array.from(panelRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
  const focusAt = (i: number) => {
    const l = links();
    if (l.length) l[((i % l.length) + l.length) % l.length].focus();
  };

  // After the panel opens via keyboard, move focus to the requested end.
  useEffect(() => {
    if (open && pendingFocus.current) focusAt(pendingFocus.current === "first" ? 0 : -1);
    pendingFocus.current = null;
  }, [open]);

  // Roving arrow-key navigation, mirroring native menu semantics.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = links();
    const idx = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { pendingFocus.current = "first"; setOpen(true); } else focusAt(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { pendingFocus.current = "last"; setOpen(true); } else focusAt(idx - 1);
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      focusAt(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      focusAt(-1);
    } else if (e.key === "Escape" && open) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

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
      onKeyDown={onKeyDown}
      // Close when focus leaves the whole group (tabbing past the last child).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1.5 text-sm font-semibold transition-colors hover:text-ink ${
          active ? "text-ink" : "text-slate"
        }`}
      >
        <NavIcon id={group.icon} className="h-[18px] w-[18px]" />
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
          ref={panelRef}
          className="absolute left-0 top-[calc(100%+18px)] z-50 min-w-[200px] rounded-sm border border-line bg-paper py-2 shadow-card"
        >
          {group.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
            const thumb = ctaThumbForHref(child.href);
            return (
              <Link
                key={child.href}
                href={mainHref(child.href, onSubdomain)}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-4 py-2 text-sm font-semibold transition-colors hover:bg-line/40 hover:text-ink ${
                  childActive ? "text-ink" : "text-slate"
                }`}
              >
                {thumb && <CtaThumb thumb={thumb} size={22} className="ring-1 ring-line" />}
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
