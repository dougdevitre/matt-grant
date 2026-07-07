"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createLiveSession, xfnv1a, DEFAULT_DT_MS, EFFECTIVE_DT_MS, type LiveSession } from "@/lib/games/engine";
import {
  buildRotation,
  rotationConfig,
  seatStatus,
  type RotationInput,
  type RotationState,
  type Seat,
} from "@/lib/games/rotation";
import type { GameContent } from "@/lib/games/content-schema";
import { EndScreen } from "./EndScreen";
import { useGameStartTelemetry } from "@/lib/games/telemetry-client";
import { RotationSeatBar } from "./RotationSeatBar";
import { useSfx } from "@/lib/games/juice/sfx";
import { MuteButton } from "./juice/MuteButton";
import { useCountUp } from "./juice/useCountUp";

// Rotation — the client view. Each seat shows its effectiveness (a bar) and a status
// (Ramping / Ready / Entrenched). The skill is timing: rotate when a seat reads Ready,
// not before (churn) or after (careerism). Drives the shared engine + records inputs
// for the same-replay score validation.

type Phase = "ready" | "playing" | "over";

interface EndData {
  score: number;
  ceiling: number;
  rank: number | null;
  flags: string[];
}

const ROUND_TICKS = rotationConfig.roundTicks;
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

const STATUS_LABEL: Record<string, string> = {
  ramping: "Ramping",
  ready: "Ready — rotate now",
  entrenched: "Entrenched",
};

function seatLabel(seat: Seat, content: GameContent): string {
  const pool = content.itemLabels.seat ?? ["Seat"];
  return pool[xfnv1a(seat.id) % pool.length];
}

export function RotationGame({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  useGameStartTelemetry(phase === "playing", content.gameId);
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const sfx = useSfx();

  const sessionRef = useRef<LiveSession<RotationState, RotationInput> | null>(null);
  const gameRef = useRef(buildRotation());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  // Seats currently in the "ready" window — used to chime once when a new one opens.
  const readyRef = useRef<Set<string>>(new Set());

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finalize = useCallback(async () => {
    stopLoop();
    const session = sessionRef.current;
    if (!session) return;
    const local = gameRef.current.score(session.state);
    sfx.play("gameover");
    // Show the local (validated-on-submit) result immediately; EndScreen submits the
    // replay to /api/games/score for the leaderboard once the player adds initials.
    setEnd({ score: local.total, ceiling: local.ceiling, rank: null, flags: local.flags });
    setPhase("over");
  }, [stopLoop, sfx]);

  const loop = useCallback(
    (ts: number) => {
      const session = sessionRef.current;
      if (!session) return;
      const elapsed = lastTsRef.current ? ts - lastTsRef.current : DEFAULT_DT_MS;
      lastTsRef.current = ts;
      session.advance(elapsed);
      // Chime once when a seat first enters its "rotate now" window.
      const prev = readyRef.current;
      const next = new Set<string>();
      for (const seat of session.state.seats) {
        if (!seat.grandfathered && seatStatus(seat.serviceTicks, rotationConfig) === "ready") {
          next.add(seat.id);
          if (!prev.has(seat.id)) sfx.play("uiClick");
        }
      }
      readyRef.current = next;
      repaint();
      if (session.isOver()) {
        void finalize();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [finalize, sfx],
  );

  const start = useCallback(() => {
    sfx.unlock();
    sfx.play("uiClick");
    gameRef.current = buildRotation();
    sessionRef.current = createLiveSession(gameRef.current, rotationConfig, seed);
    lastTsRef.current = 0;
    readyRef.current = new Set();
    setFeedback("");
    setEnd(null);
    setPhase("playing");
    rafRef.current = requestAnimationFrame(loop);
  }, [seed, loop, sfx]);

  const playAgain = useCallback(() => {
    setSeed(newSeed());
    setPhase("ready");
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const rotate = useCallback(
    (seat: Seat) => {
      const session = sessionRef.current;
      if (!session || phase !== "playing") return;
      const status = seatStatus(seat.serviceTicks, rotationConfig);
      if (seat.grandfathered) {
        setFeedback("Handed off an incumbent — exempt");
        sfx.play("uiClick");
      } else if (status === "ready") {
        setFeedback("✓ Rotated in the sweet spot");
        sfx.play("collect");
      } else if (status === "ramping") {
        setFeedback("✗ Too early — ramp wasted");
        sfx.play("hit");
      } else {
        setFeedback("✗ Too late — careerism");
        sfx.play("hit");
      }
      session.enqueue({ kind: "rotate", seatId: seat.id });
    },
    [phase, sfx],
  );

  const session = sessionRef.current;
  const state = session?.state;
  const secondsLeft = state
    ? (ROUND_TICKS - state.tick) * (EFFECTIVE_DT_MS / 1000)
    : ROUND_TICKS * (EFFECTIVE_DT_MS / 1000);
  const displayCaptured = useCountUp(state ? Math.round(state.captured) : 0, 300);

  return (
    <div className="space-y-6">
      {phase === "ready" && (
        <div className="rounded-lg border border-line bg-white p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-slate">{content.eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{content.title}</h1>
            </div>
            <MuteButton />
          </div>
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
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-line bg-white p-4 shadow-card" role="status" aria-live="polite">
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Effectiveness</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{displayCaptured.toLocaleString("en-US")}</span>
            </div>
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Clean rotations</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{state.rotationsClean}</span>
            </div>
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Time</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{Math.max(0, Math.ceil(secondsLeft))}s</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="assertive">
              {feedback}
            </p>
            <MuteButton />
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {state.seats.map((seat) => {
              const status = seatStatus(seat.serviceTicks, rotationConfig);
              const ready = status === "ready";
              const entrenched = status === "entrenched";
              return (
                <li
                  key={seat.id}
                  className={`rounded-lg border bg-white p-4 shadow-card transition-colors ${
                    ready ? "rot-ready border-brick" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {seatLabel(seat, content)}
                      {seat.grandfathered && (
                        <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate">
                          Grandfathered
                        </span>
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold ${
                        ready ? "text-brick" : entrenched ? "text-slate" : "text-slate"
                      }`}
                    >
                      <span aria-hidden="true">{ready ? "◆" : entrenched ? "■" : "▲"}</span>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>

                  <RotationSeatBar seat={seat} />

                  <button
                    onClick={() => rotate(seat)}
                    className={`mt-3 w-full text-xs ${ready ? "btn-brick" : "btn-ghost"}`}
                    aria-label={`Rotate ${seatLabel(seat, content)} — currently ${STATUS_LABEL[status]}`}
                  >
                    Rotate ⟳
                  </button>
                </li>
              );
            })}
          </ul>

          <style jsx>{`
            .rot-ready {
              animation: rot-ready 1.1s ease-in-out infinite;
            }
            @keyframes rot-ready {
              0%, 100% { box-shadow: 0 0 0 0 rgba(181, 52, 59, 0); }
              50% { box-shadow: 0 0 0 4px rgba(181, 52, 59, 0.18); }
            }
            @media (prefers-reduced-motion: reduce) {
              .rot-ready { animation: none; }
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
