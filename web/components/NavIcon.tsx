import type { ReactNode } from "react";

// Civic line icons for the four nav groups. Stroked, currentColor, sized by the
// caller — so a group reads as a unit (icon + label) instead of a label stranded
// from its chevron. Unknown id → nothing (the row just renders without an icon).
const PATHS: Record<string, ReactNode> = {
  // About → the candidate (a person)
  about: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  // Get Involved → a megaphone
  getInvolved: (
    <>
      <path d="M4 10v4h3l9 4.5V5.5L7 10H4z" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  // Vote → a marked ballot
  vote: (
    <>
      <rect x="4" y="4.5" width="16" height="15" rx="2" />
      <path d="M8.5 12.5l2.4 2.4 4.6-5" />
    </>
  ),
  // News → a newspaper
  news: (
    <>
      <path d="M4 6h13v13H5.5A1.5 1.5 0 0 1 4 17.5V6z" />
      <path d="M17 9h3v8.5a1.5 1.5 0 0 1-3 0" />
      <path d="M7 9.5h7M7 12.5h7M7 15.5h4" />
    </>
  ),
};

export function NavIcon({ id, className }: { id?: string; className?: string }) {
  const node = id ? PATHS[id] : null;
  if (!node) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {node}
    </svg>
  );
}
