"use client";

import { useEffect, useRef, useState } from "react";
import { ShareCard } from "./ShareCard";
import { OptInForm } from "./OptInForm";
import { GameLeaderboard } from "./GameLeaderboard";

// End-of-round screen: the lesson (endLines), the share card (carries the
// disclaimer), share + opt-in + a click-through back to the canonical issue page,
// and "play again". Emits the telemetry the host wires in via callbacks.

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Animate a number from 0 → target with an ease-out; snaps under reduced motion.
function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);
  return value;
}

// Personal best per game, persisted in localStorage. Returns the best AND whether
// THIS score set a new one (computed once on mount).
function usePersonalBest(gameId: string, score: number): { best: number; isNewBest: boolean } {
  const [state, setState] = useState<{ best: number; isNewBest: boolean }>({ best: score, isNewBest: false });
  useEffect(() => {
    try {
      const key = `games:best:${gameId}`;
      const prev = Number(localStorage.getItem(key) ?? 0);
      if (score > prev) {
        localStorage.setItem(key, String(score));
        setState({ best: score, isNewBest: prev > 0 }); // first-ever score isn't a "new best" banner
      } else {
        setState({ best: prev, isNewBest: false });
      }
    } catch {
      setState({ best: score, isNewBest: false });
    }
  }, [gameId, score]);
  return state;
}

export interface EndScreenProps {
  gameId: string;
  title: string;
  score: number;
  ceiling: number;
  rank: number | null;
  flags: string[];
  endLines: string[];
  shareText: string;
  issueSlug: string;
  issueLabel: string;
  onPlayAgain: () => void;
  onShare?: () => void;
  onOptIn?: (channel: "email" | "sms") => void;
  onIssueClick?: () => void;
}

const APEX = "https://mattgrantforcongress.org";

export function EndScreen(props: EndScreenProps) {
  const [shared, setShared] = useState(false);
  const animatedScore = useCountUp(props.score);
  const { best, isNewBest } = usePersonalBest(props.gameId, props.score);

  async function share() {
    props.onShare?.();
    const url = `${APEX}/issues/${props.issueSlug}`;
    const text = `${props.shareText} (Score: ${props.score.toLocaleString("en-US")})`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: props.title, text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(true);
      }
    } catch {
      /* user cancelled share — no-op */
    }
  }

  return (
    <section className="space-y-8" aria-labelledby="end-heading">
      <div>
        <p className="eyebrow text-slate">{props.title} — results</p>
        <h2 id="end-heading" className="mt-2 text-3xl font-semibold sm:text-4xl">
          You scored{" "}
          <span className="font-mono tabular-nums">{animatedScore.toLocaleString("en-US")}</span>
          {/* The animated value is decorative; expose the final score to assistive tech. */}
          <span className="sr-only">{props.score.toLocaleString("en-US")}</span>
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
          {isNewBest && (
            <span className="font-bold uppercase tracking-wide text-brick">★ New personal best</span>
          )}
          <span>
            Personal best: <span className="font-mono tabular-nums">{best.toLocaleString("en-US")}</span>
          </span>
          {props.rank != null && <span>Rank #{props.rank} on the leaderboard</span>}
        </div>
        <ul className="mt-4 space-y-1">
          {props.endLines.map((line) => (
            <li key={line} className="text-base text-ink">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <ShareCard title={props.title} score={props.score} shareText={props.shareText} flags={props.flags} />

      <GameLeaderboard gameId={props.gameId} highlightScore={props.score} />

      <div className="flex flex-wrap gap-3">
        <button onClick={props.onPlayAgain} className="btn-brick">
          Play again
        </button>
        <button onClick={share} className="btn-ink">
          {shared ? "Copied!" : "Share"}
        </button>
        <a
          href={`${APEX}/issues/${props.issueSlug}`}
          onClick={props.onIssueClick}
          className="btn-ghost"
        >
          Read: {props.issueLabel} →
        </a>
      </div>

      <div className="max-w-md rounded-lg border border-line bg-white p-5 shadow-card">
        <OptInForm gameId={props.gameId} score={props.score} onSubmitted={props.onOptIn} />
      </div>
    </section>
  );
}
