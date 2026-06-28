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
  no_family_harmed: "No families harmed",
  no_borrow: "No borrowing",
  no_bloat: "No waste left behind",
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
            {flags.map((f) => (
              <li key={f} className="rounded-sm border border-paper/30 px-2 py-1 text-xs">
                ✓ {FLAG_LABEL[f] ?? f}
              </li>
            ))}
          </ul>
        )}
      </div>
      <figcaption className="border-t border-paper/20 px-6 py-3 text-[0.7rem] text-paper/70">
        {CAMPAIGN.paidForBy}
      </figcaption>
    </figure>
  );
}
