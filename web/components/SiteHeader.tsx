"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CAMPAIGN, NAV } from "@/lib/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center" onClick={() => setOpen(false)} aria-label="Matt Grant for Congress — home">
          <Image
            src="/brand/logo.png"
            alt={`Matt Grant for Congress — ${CAMPAIGN.district}`}
            width={132}
            height={132}
            priority
            className="h-12 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-sm font-semibold transition-colors hover:text-ink ${
                  active ? "text-ink" : "text-slate"
                }`}
              >
                {item.label}
                {active && <span className="absolute -bottom-[26px] left-0 h-[3px] w-full bg-gold" />}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Donate
          </a>
        </div>

        <button
          className="lg:hidden btn-ghost px-3 py-2"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper lg:hidden">
          <nav className="container-page flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3 text-sm font-semibold text-ink"
              >
                {item.label}
              </Link>
            ))}
            <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
              Donate
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
