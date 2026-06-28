"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createLiveSession, xfnv1a, DEFAULT_DT_MS, type LiveSession } from "@/lib/games/engine";
import {
  buildClarityCompanion,
  clarityConfig,
  type ClarityInput,
  type ClarityState,
  type RecordCard,
} from "@/lib/games/clarity-companion";
import type { GameContent } from "@/lib/games/content-schema";
import { EndScreen } from "./EndScreen";
import { ClarityRecordCard } from "./ClarityRecordCard";

// Clarity Companion — the client view. Triage each record: Open (public), Protect
// (child), or Redact & Open (mixed). Two meters must both stay up. The record TYPE is
// shown as a generic category label; judging which action fits is the skill. Drives
// the shared engine + records inputs for the same-replay score validation.

type Phase = "ready" | "playing" | "over";

interface EndData {
  score: number;
  ceiling: number;
  rank: number | null;
  flags: string[];
}

const ROUND_TICKS = clarityConfig.roundTicks;
const FLOOR = clarityConfig.meterFloor;
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

function cardLabel(card: RecordCard, content: GameContent): string {
  const pool = content.itemLabels[card.type] ?? [card.type];
  return pool[xfnv1a(card.id) % pool.length];
}

function Meter({ label, value }: { label: string; value: number }) {
  const low = value < FLOOR;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="eyebrow text-slate">
          {/* Status is color-independent: icon + text, not the bar color alone. */}
          {low ? <span aria-hidden="true">⚠ </span> : null}
          {label}
          {low ? " — at risk (below floor)" : ""}
        </span>
        <span className={`font-mono text-xs tabular-nums ${low ? "text-brick" : "text-slate"}`}>
          {value}/100
        </span>
      </div>
      <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
        <span
          className={`clarity-meter block h-full ${low ? "bg-brick" : "bg-ink"}`}
          style={{ width: `${value}%` }}
          aria-hidden="true"
        />
        {/* Shared floor marker — the "both must stay above this" line, read at a glance. */}
        <span
          className="clarity-floor pointer-events-none absolute inset-y-0 w-px bg-ink/40"
          style={{ left: `${FLOOR}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function ClarityCompanion({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  const sessionRef = useRef<LiveSession<ClarityState, ClarityInput> | null>(null);
  const gameRef = useRef(buildClarityCompanion());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finalize = useCallback(async () => {
    stopLoop();
    const session = sessionRef.current;
    if (!session) return;
    const local = gameRef.current.score(session.state);
    // Show the local (validated-on-submit) result immediately; EndScreen submits the
    // replay to /api/games/score for the leaderboard once the player adds initials.
    setEnd({ score: local.total, ceiling: local.ceiling, rank: null, flags: local.flags });
    setPhase("over");
  }, [stopLoop]);

  const loop = useCallback(
    (ts: number) => {
      const session = sessionRef.current;
      if (!session) return;
      const elapsed = lastTsRef.current ? ts - lastTsRef.current : DEFAULT_DT_MS;
      lastTsRef.current = ts;
      session.advance(elapsed);
      repaint();
      if (session.isOver()) {
        void finalize();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [finalize],
  );

  const start = useCallback(() => {
    gameRef.current = buildClarityCompanion();
    sessionRef.current = createLiveSession(gameRef.current, clarityConfig, seed);
    lastTsRef.current = 0;
    setFeedback("");
    setEnd(null);
    setPhase("playing");
    rafRef.current = requestAnimationFrame(loop);
  }, [seed, loop]);

  const playAgain = useCallback(() => {
    setSeed(newSeed());
    setPhase("ready");
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const act = useCallback(
    (card: RecordCard, kind: ClarityInput["kind"]) => {
      const session = sessionRef.current;
      if (!session || phase !== "playing") return;
      const correct =
        (kind === "open" && card.type === "public") ||
        (kind === "protect" && card.type === "child") ||
        (kind === "redact" && card.type === "mixed");
      setFeedback(correct ? "✓ Right call" : kind === "protect" ? "✗ Over-sealed a public record" : "✗ Exposed a child");
      session.enqueue({ kind, id: card.id });
    },
    [phase],
  );

  const session = sessionRef.current;
  const state = session?.state;
  const secondsLeft = state
    ? (ROUND_TICKS - state.tick) * (DEFAULT_DT_MS / 1000)
    : ROUND_TICKS * (DEFAULT_DT_MS / 1000);

  return (
    <div className="space-y-6">
      {phase === "ready" && (
        <div className="rounded-lg border border-line bg-white p-6 shadow-card">
          <p className="eyebrow text-slate">{content.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{content.title}</h1>
          <p className="mt-2 max-w-prose text-slate">{content.tagline}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink">
            {content.howTo.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button onClick={start} className="btn-brick mt-6">
            Start
          </button>
        </div>
      )}

      {phase === "playing" && state && (
        <>
          <div className="rounded-lg border border-line bg-white p-4 shadow-card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <Meter label="Accountability" value={state.accountability} />
              <Meter label="Child privacy" value={state.childPrivacy} />
              <div className="flex flex-col sm:items-end">
                <span className="eyebrow text-slate">Time</span>
                <span className="font-mono text-lg font-bold tabular-nums text-ink">{Math.max(0, Math.ceil(secondsLeft))}s</span>
              </div>
            </div>
            {/* Couples the two meters: both share one floor, both must stay above it. */}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate">
              <span aria-hidden="true" className="inline-block h-3 w-px bg-ink/40" />
              Keep <span className="font-medium text-ink">both</span> meters above the shared floor ({FLOOR}/100).
            </p>
          </div>

          <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="assertive">
            {feedback}
          </p>

          <ul className="space-y-3" aria-label="Incoming records — triage each one">
            {state.queue.map((card) => (
              <ClarityRecordCard
                key={card.id}
                card={card}
                label={cardLabel(card, content)}
                currentTick={state.tick}
                onAct={act}
              />
            ))}
            {state.queue.length === 0 && (
              <li className="py-8 text-center text-sm text-slate">No records in the queue — stay ready.</li>
            )}
          </ul>

          <style jsx>{`
            .clarity-meter {
              transition: width 320ms cubic-bezier(0.4, 0, 0.2, 1),
                background-color 320ms ease;
            }
            @media (prefers-reduced-motion: reduce) {
              .clarity-meter {
                transition: none;
              }
            }
          `}</style>
        </>
      )}

      {phase === "over" && end && (
        <EndScreen
          gameId={content.gameId}
          title={content.title}
          score={end.score}
          ceiling={end.ceiling}
          flags={end.flags}
          seed={seed}
          inputs={sessionRef.current?.inputs ?? []}
          totalTicks={ROUND_TICKS}
          endLines={content.endLines}
          shareText={content.shareText}
          issueSlug={content.issueSlug}
          issueLabel={content.eyebrow}
          onPlayAgain={playAgain}
        />
      )}
    </div>
  );
}
