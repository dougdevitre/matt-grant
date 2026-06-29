"use client";

import { useEffect, useState } from "react";

// Compact top-N anonymous leaderboard for a game. Reads the existing
// /api/games/leaderboard endpoint (initials + score, no PII) and renders nothing
// until there are entries — so it stays quiet in dev / before any scores exist.

interface Entry {
  initials: string;
  score: number;
}

export function GameLeaderboard({
  gameId,
  highlightScore,
  refreshKey = 0,
}: {
  gameId: string;
  highlightScore?: number;
  /** bump to re-fetch (e.g. after the player submits their score) */
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/games/leaderboard?game=${encodeURIComponent(gameId)}&limit=10`);
        if (!res.ok) return;
        const j = (await res.json()) as { entries?: Entry[] };
        if (alive) setEntries(j.entries ?? []);
      } catch {
        /* leaderboard is best-effort — never block the end screen */
      }
    })();
    return () => {
      alive = false;
    };
  }, [gameId, refreshKey]);

  if (!entries || entries.length === 0) {
    return (
      <div className="max-w-md rounded-lg border border-line bg-white p-5 shadow-card">
        <p className="eyebrow text-slate">Top players</p>
        <p className="mt-3 text-sm text-slate">No scores yet — be the first on the board.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-lg border border-line bg-white p-5 shadow-card">
      <p className="eyebrow text-slate">Top players</p>
      <ol className="mt-3 space-y-1">
        {entries.map((e, i) => {
          const isYou = highlightScore != null && e.score === highlightScore;
          return (
            <li
              key={`${e.initials}-${e.score}-${i}`}
              className={`flex items-center justify-between font-mono text-sm tabular-nums ${isYou ? "font-bold text-ink" : "text-slate"}`}
            >
              <span>
                <span className="inline-block w-6 text-right">{i + 1}.</span>{" "}
                <span className="ml-2 uppercase">{e.initials}</span>
                {isYou && <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-brick">you</span>}
              </span>
              <span>{e.score.toLocaleString("en-US")}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
