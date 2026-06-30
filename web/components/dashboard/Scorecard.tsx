import Link from "next/link";
import { TIER_LABEL, NEXT_ACTION, type CaptainScore } from "@/lib/volunteers/score";

const tierCls: Record<string, string> = {
  excellent: "bg-field/10 text-field",
  strong: "bg-field/10 text-field",
  building: "bg-gold/15 text-ink",
  "needs-attention": "bg-brick/10 text-brick",
  new: "bg-ink/5 text-slate",
};

// A score bar — the number is shown as text too, so the bar is decorative
// (aria-hidden) and color is never the only signal.
function Bar({ score }: { score: number }) {
  return (
    <div aria-hidden className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
      <div
        className={`h-full rounded-full ${score >= 70 ? "bg-field" : score >= 50 ? "bg-gold" : "bg-brick"}`}
        style={{ width: `${Math.max(score, 2)}%` }}
      />
    </div>
  );
}

export function Scorecard({
  name,
  score,
  regions,
  rank,
}: {
  name: string;
  score: CaptainScore;
  regions?: string[];
  rank?: number;
}) {
  const next = score.weakest ? NEXT_ACTION[score.weakest] : null;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-ink">
            {rank != null && <span className="mr-1 text-slate">#{rank}</span>}
            {name}
          </p>
          {regions && regions.length > 0 && (
            <p className="mt-0.5 text-xs text-slate">{regions.join(" · ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl text-ink">{score.hasActivity ? score.total : "—"}</p>
          <span className={`mt-1 inline-block rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${tierCls[score.tier]}`}>
            {TIER_LABEL[score.tier]}
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {score.components.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-ink">{c.label}</span>
              <span className="font-mono text-xs text-slate">{c.score}</span>
            </div>
            <Bar score={c.score} />
            <p className="mt-0.5 text-[0.7rem] text-slate">{c.detail}</p>
          </li>
        ))}
      </ul>

      {next && (
        <div className="mt-4 rounded-sm border border-line bg-paper p-3">
          <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">Next best action</p>
          <p className="mt-1 text-sm text-ink">{next.text}</p>
          <Link href={next.href} className="mt-1 inline-block text-xs font-semibold text-brick underline">
            {next.where} →
          </Link>
        </div>
      )}
    </div>
  );
}
