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
  flags: string[];
  endLines: string[];
  shareText: string;
  issueSlug: string;
  issueLabel: string;
  /** the round's (seed, inputs, totalTicks) — EndScreen submits these for the
   *  replay-validated leaderboard entry once the player adds initials (or skips). */
  seed: string;
  inputs: unknown[];
  totalTicks: number;
  onPlayAgain: () => void;
  onShare?: () => void;
  onOptIn?: (channel: "email" | "sms") => void;
  onIssueClick?: () => void;
}

const APEX = "https://mattgrantforcongress.org";

// 0–3 uppercase letters, classic arcade initials.
const cleanInitials = (raw: string) => raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

export function EndScreen(props: EndScreenProps) {
  const [shared, setShared] = useState(false);
  const animatedScore = useCountUp(props.score);
  const { best, isNewBest } = usePersonalBest(props.gameId, props.score);

  // Leaderboard submission lives here (centralized) — the server re-validates the
  // (seed, inputs) replay, so a tampered score can't be recorded under any initials.
  const [initials, setInitials] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "done">("idle");
  const [rank, setRank] = useState<number | null>(null);
  const [lbKey, setLbKey] = useState(0);

  async function submitScore(withInitials: string) {
    if (submitState !== "idle") return;
    setSubmitState("saving");
    try {
      const res = await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: props.gameId,
          seed: props.seed,
          inputs: props.inputs,
          totalTicks: props.totalTicks,
          reportedScore: props.score,
          initials: withInitials || undefined,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { rank: number | null };
        setRank(j.rank);
        setLbKey((k) => k + 1); // refresh the leaderboard to include this entry
      }
    } catch {
      /* offline / rejected — leave it unrecorded, the score is still shown locally */
    }
    setSubmitState("done");
  }

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
          {rank != null && <span>Rank #{rank} on the leaderboard</span>}
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

      {/* Add your initials to the (replay-validated) leaderboard. */}
      {submitState !== "done" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitScore(cleanInitials(initials));
          }}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-5 shadow-card"
        >
          <div>
            <label htmlFor="lb-initials" className="eyebrow text-slate">
              Your initials
            </label>
            <input
              id="lb-initials"
              value={initials}
              onChange={(e) => setInitials(cleanInitials(e.target.value))}
              placeholder="AAA"
              inputMode="text"
              autoCapitalize="characters"
              maxLength={3}
              className="mt-1 w-24 rounded-sm border border-line bg-white px-3 py-2 text-center font-mono text-lg uppercase tracking-widest"
            />
          </div>
          <button type="submit" disabled={submitState === "saving"} className="btn-ink disabled:opacity-50">
            {submitState === "saving" ? "Saving…" : "Add to leaderboard"}
          </button>
          <button
            type="button"
            onClick={() => void submitScore("")}
            disabled={submitState === "saving"}
            className="btn-ghost"
          >
            Skip
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate">
          {rank != null ? `Recorded — you're rank #${rank}.` : "Thanks for playing."}
        </p>
      )}

      <GameLeaderboard gameId={props.gameId} highlightScore={props.score} refreshKey={lbKey} />

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
