"use client";

import { CAMPAIGN } from "@/lib/site";

// The share moment. Renders the player's result + the game's share line and ALWAYS
// the FEC disclaimer (every share card carries it — spec §12). The disclaimer text
// comes from CAMPAIGN.paidForBy (single source of truth the compliance gate enforces),
// never a hard-coded literal.

export interface ShareCardProps {
  title: string;
  score: number;
  shareText: string;
  flags: string[];
}

const FLAG_LABEL: Record<string, string> = {
  // Cut & Save
  no_family_harmed: "No families harmed",
  no_borrow: "No borrowing",
  no_bloat: "No waste left behind",
  // Org Chart
  right_sized: "Right-sized to the band",
  service_intact: "Services intact",
  // Rotation
  no_careerism: "No careerism",
  no_churn: "No wasted ramp",
  served_the_sweet_spot: "Served the sweet spot",
  // Clarity Companion
  both_upheld: "Accountability + privacy upheld",
  no_child_exposed: "No child exposed",
  nothing_over_sealed: "Nothing over-sealed",
};

// Flags that represent a failure/warning are shown with a ✗, not a ✓.
const NEGATIVE_FLAGS = new Set(["service_collapsed", "bloat_wins", "overcut", "balance_broken"]);
const NEGATIVE_LABEL: Record<string, string> = {
  service_collapsed: "Service collapsed",
  bloat_wins: "Bloat won — over the band",
  overcut: "Overcut — under the band",
  balance_broken: "Balance broken — a meter collapsed",
};

export function ShareCard({ title, score, shareText, flags }: ShareCardProps) {
  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-ink text-paper shadow-card">
      <div className="p-6">
        <p className="eyebrow text-goldlight">{title}</p>
        <p className="mt-2 font-mono text-4xl font-bold tabular-nums">{score.toLocaleString("en-US")}</p>
        <p className="mt-3 max-w-prose text-sm text-paper/85">{shareText}</p>
        {flags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {flags.map((f) => {
              const negative = NEGATIVE_FLAGS.has(f);
              const text = negative ? NEGATIVE_LABEL[f] ?? f : FLAG_LABEL[f] ?? f;
              return (
                <li key={f} className="rounded-sm border border-paper/30 px-2 py-1 text-xs">
                  {negative ? "✗" : "✓"} {text}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <figcaption className="border-t border-paper/20 px-6 py-3 text-[0.7rem] text-paper/70">
        {CAMPAIGN.paidForBy}
      </figcaption>
    </figure>
  );
}
