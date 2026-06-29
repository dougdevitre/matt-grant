import Link from "next/link";
import type { Metadata } from "next";
import { GAMES } from "@/lib/games/registry";
import { gameFlags } from "@/lib/games/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // flags can change without a deploy

export const metadata: Metadata = {
  title: "Four Fights Arcade",
};

// Arcade menu. One card per priority game. `enabled` is the live flag state (registry
// default, overridable via SSM so compliance can pull a game without a deploy);
// disabled games show as "coming soon" and aren't linkable.

export default async function GamesHome() {
  const flags = await gameFlags();

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="eyebrow text-slate">Four priorities, four games</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Four Fights Arcade</h1>
        <p className="mt-3 text-slate">
          A quick civic mini-game for each of Matt Grant&apos;s four priorities for Missouri&apos;s 2nd District. Each
          plays in under a minute — and the winning strategy is the point.
        </p>
        <p className="mt-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink shadow-card">
          <span className="font-semibold">Play any one game free.</span>{" "}
          <Link href="/sign-up" className="text-brick underline hover:text-ink">
            Become a member — free —
          </Link>{" "}
          to unlock all four.
        </p>
      </header>

      <ul className="grid gap-5 sm:grid-cols-2">
        {GAMES.filter((g) => !g.hidden).map((g) => {
          const enabled = flags[g.id] !== false && g.enabled;
          const card = (
            <div className="flex h-full flex-col rounded-lg border border-line bg-white p-6 shadow-card">
              <p className="eyebrow text-slate">{g.issue}</p>
              <h2 className="mt-2 text-2xl font-semibold">{g.title}</h2>
              <p className="mt-2 flex-1 text-sm text-slate">{g.blurb}</p>
              <span className={`mt-4 text-sm font-bold uppercase tracking-wide ${enabled ? "text-brick" : "text-slate"}`}>
                {enabled ? "Play →" : "Coming soon"}
              </span>
            </div>
          );
          return (
            <li key={g.id}>
              {enabled ? (
                <Link href={`/games/${g.id}`} className="block h-full focus-visible:outline-none">
                  {card}
                </Link>
              ) : (
                <div aria-disabled className="h-full opacity-70">
                  {card}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
