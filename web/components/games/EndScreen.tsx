"use client";

import { useState } from "react";
import { ShareCard } from "./ShareCard";
import { OptInForm } from "./OptInForm";

// End-of-round screen: the lesson (endLines), the share card (carries the
// disclaimer), share + opt-in + a click-through back to the canonical issue page,
// and "play again". Emits the telemetry the host wires in via callbacks.

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
          You funded {props.score.toLocaleString("en-US")} in relief
        </h2>
        {props.rank != null && <p className="mt-1 text-sm text-slate">Rank #{props.rank} on the leaderboard.</p>}
        <ul className="mt-4 space-y-1">
          {props.endLines.map((line) => (
            <li key={line} className="text-base text-ink">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <ShareCard title={props.title} score={props.score} shareText={props.shareText} flags={props.flags} />

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
