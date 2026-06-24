"use client";

import type { ReactNode } from "react";

// Triggers the browser's print dialog for the current page. The page's `@media
// print` rules (globals.css) isolate the `.printable` container, so only the
// run-of-show sheet prints — the dashboard chrome is hidden. Carries `.no-print`
// so the button never appears on the printed sheet itself.
export function PrintButton({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <button type="button" className={`no-print ${className ?? ""}`} onClick={() => window.print()}>
      {children ?? "Print"}
    </button>
  );
}
