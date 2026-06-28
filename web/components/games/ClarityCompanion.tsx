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
          {label}
          {low ? " — at risk" : ""}
        </span>
        <span className="font-mono text-xs tabular-nums text-slate">{value}/100</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        <span className={`block h-full ${low ? "bg-brick" : "bg-ink"}`} style={{ width: `${value}%` }} />
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
    setPhase("over");
    let data: EndData = { score: local.total, ceiling: local.ceiling, rank: null, flags: local.flags };
    try {
      const res = await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: content.gameId,
          seed,
          inputs: session.inputs,
          totalTicks: ROUND_TICKS,
          reportedScore: local.total,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { score: number; ceiling: number; rank: number | null; flags: string[] };
        data = { score: j.score, ceiling: j.ceiling, rank: j.rank, flags: j.flags };
      }
    } catch {
      /* offline / rejected — keep the local result */
    }
    setEnd(data);
  }, [content.gameId, seed, stopLoop]);

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
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-[1fr_1fr_auto]">
            <Meter label="Accountability" value={state.accountability} />
            <Meter label="Child privacy" value={state.childPrivacy} />
            <div className="flex flex-col sm:items-end">
              <span className="eyebrow text-slate">Time</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{Math.max(0, Math.ceil(secondsLeft))}s</span>
            </div>
          </div>

          <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="assertive">
            {feedback}
          </p>

          <ul className="space-y-3" aria-label="Incoming records — triage each one">
            {state.queue.map((card) => (
              <li key={card.id} className="rounded-lg border border-line bg-white p-3 shadow-card">
                <p className="text-sm font-semibold text-ink">{cardLabel(card, content)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => act(card, "open")} className="btn-ghost text-xs" aria-label={`Open ${cardLabel(card, content)}`}>
                    Open
                  </button>
                  <button onClick={() => act(card, "protect")} className="btn-ghost text-xs" aria-label={`Protect ${cardLabel(card, content)}`}>
                    Protect
                  </button>
                  <button onClick={() => act(card, "redact")} className="btn-ghost text-xs" aria-label={`Redact and open ${cardLabel(card, content)}`}>
                    Redact &amp; Open
                  </button>
                </div>
              </li>
            ))}
            {state.queue.length === 0 && (
              <li className="py-8 text-center text-sm text-slate">No records in the queue — stay ready.</li>
            )}
          </ul>
        </>
      )}

      {phase === "over" && end && (
        <EndScreen
          gameId={content.gameId}
          title={content.title}
          score={end.score}
          ceiling={end.ceiling}
          rank={end.rank}
          flags={end.flags}
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
