"use client";

import { useState } from "react";

// Copies ready-to-post text to the clipboard — for channels published manually.
export function CopyButton({ text, label = "Copy text" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked — the text is selectable in the box below */
        }
      }}
      className="rounded-sm border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-ink"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
