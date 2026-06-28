"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createLiveSession, DEFAULT_DT_MS, type LiveSession } from "@/lib/games/engine";
import {
  buildRedTapeRun,
  redTapeRunConfig,
  type RedTapeRunInput,
  type RedTapeRunState,
  type RunEntity,
} from "@/lib/games/red-tape-run";
import type { GameContent } from "@/lib/games/content-schema";
import { EndScreen } from "./EndScreen";

// Red Tape Run — a Pitfall-style runner. The sim is the shared deterministic engine;
// this view renders the side-scrolling track, takes one input (JUMP), and records it
// for the same-replay score validation. Jump to clear procedural-abuse hazards; stay
// grounded to grab reforms. One button, keyboard- and tap-operable.

type Phase = "ready" | "playing" | "over";

interface EndData {
  score: number;
  ceiling: number;
  flags: string[];
}

const ROUND_TICKS = redTapeRunConfig.roundTicks;
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

// Render mapping (world units → CSS).
const PLAYER_LEFT_PCT = 14;
const RENDER_AHEAD = 230; // world units visible ahead of the player
const VSCALE = 1.35; // px per world y-unit
const GROUND_PX = 26;

const OUTCOME_TEXT: Record<string, string> = {
  clear: "✓ Dodged it",
  collect: "＋ Reform secured",
  hit: "✗ Hit — integrity lost",
  miss: "… reform missed",
};

function entityLabel(e: RunEntity, content: GameContent): string {
  const pool = content.itemLabels[e.kind] ?? [e.kind];
  return pool[e.variant % pool.length];
}

export function RedTapeRun({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  const sessionRef = useRef<LiveSession<RedTapeRunState, RedTapeRunInput> | null>(null);
  const gameRef = useRef(buildRedTapeRun());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finalize = useCallback(() => {
    stopLoop();
    const session = sessionRef.current;
    if (!session) return;
    const local = gameRef.current.score(session.state);
    setEnd({ score: local.total, ceiling: local.ceiling, flags: local.flags });
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
        finalize();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [finalize],
  );

  const start = useCallback(() => {
    gameRef.current = buildRedTapeRun();
    sessionRef.current = createLiveSession(gameRef.current, redTapeRunConfig, seed);
    lastTsRef.current = 0;
    setEnd(null);
    setPhase("playing");
    rafRef.current = requestAnimationFrame(loop);
  }, [seed, loop]);

  const playAgain = useCallback(() => {
    setSeed(newSeed());
    setPhase("ready");
  }, []);

  const jump = useCallback(() => {
    if (phase === "playing") sessionRef.current?.enqueue({ kind: "jump" });
  }, [phase]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  // Keyboard: Space / ArrowUp / W jump while playing.
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, jump]);

  const session = sessionRef.current;
  const state = session?.state;
  const secondsLeft = state
    ? (ROUND_TICKS - state.tick) * (DEFAULT_DT_MS / 1000)
    : ROUND_TICKS * (DEFAULT_DT_MS / 1000);

  // Build the visible slice of the track (entities ahead of the player, in view).
  const visible: { e: RunEntity; delta: number }[] = [];
  if (state) {
    for (let i = state.nextIdx; i < state.entities.length; i++) {
      const delta = state.entities[i].worldPos - state.worldX;
      if (delta > RENDER_AHEAD) break;
      if (delta < -16) continue;
      visible.push({ e: state.entities[i], delta });
    }
  }

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
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-4" role="status" aria-live="off">
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Score</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{state.score.toLocaleString("en-US")}</span>
            </div>
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Reforms</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{state.reformsCollected}</span>
            </div>
            <div className="col-span-2 flex flex-col">
              <span className="eyebrow text-slate">Integrity {state.integrity < 40 ? "— low" : ""}</span>
              <span className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span
                  className={`block h-full ${state.integrity < 40 ? "bg-brick" : "bg-ink"}`}
                  style={{ width: `${state.integrity}%` }}
                />
              </span>
            </div>
          </div>

          {/* The track. Clicking it (or Space/↑) jumps. */}
          <button
            type="button"
            onClick={jump}
            aria-label="Jump (or press Space / Up arrow)"
            className="relative block h-[260px] w-full overflow-hidden rounded-lg border border-line bg-paper text-left shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            {/* ground */}
            <span className="absolute inset-x-0 bottom-0 border-t border-line bg-white" style={{ height: GROUND_PX }} aria-hidden="true" />

            {/* runner */}
            <span
              className="absolute z-10 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-sm bg-ink text-paper"
              style={{ left: `${PLAYER_LEFT_PCT}%`, bottom: GROUND_PX + state.y * VSCALE }}
              aria-hidden="true"
            >
              <span className="text-base leading-none">🏃</span>
            </span>

            {/* entities */}
            {visible.map(({ e, delta }) => {
              const leftPct = PLAYER_LEFT_PCT + (delta / RENDER_AHEAD) * (100 - PLAYER_LEFT_PCT);
              const label = entityLabel(e, content);
              if (e.kind === "abuse") {
                return (
                  <span
                    key={e.id}
                    className="absolute flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${leftPct}%`, bottom: GROUND_PX }}
                    aria-hidden="true"
                  >
                    <span className="mb-1 max-w-[7rem] text-center text-[0.6rem] font-semibold leading-tight text-brick">
                      {label}
                    </span>
                    <span className="flex h-14 w-7 items-end justify-center rounded-sm border-2 border-brick bg-brick/10 pb-0.5 text-brick">
                      ⚠
                    </span>
                  </span>
                );
              }
              return (
                <span
                  key={e.id}
                  className="absolute flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${leftPct}%`, bottom: GROUND_PX }}
                  aria-hidden="true"
                >
                  <span className="mb-1 max-w-[7rem] text-center text-[0.6rem] font-semibold leading-tight text-ink">
                    {label}
                  </span>
                  <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-gold bg-gold/15 text-ink">
                    ＋
                  </span>
                </span>
              );
            })}

            {/* timer */}
            <span className="absolute right-3 top-2 font-mono text-xs tabular-nums text-slate" aria-hidden="true">
              {Math.max(0, Math.ceil(secondsLeft))}s
            </span>
          </button>

          <div className="flex items-center justify-between">
            <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="polite">
              {state.lastOutcome ? OUTCOME_TEXT[state.lastOutcome] : ""}
            </p>
            <button onClick={jump} className="btn-ink" aria-label="Jump">
              Jump ⤒
            </button>
          </div>
        </>
      )}

      {phase === "over" && end && (
        <EndScreen
          gameId={content.gameId}
          title={content.title}
          score={end.score}
          ceiling={end.ceiling}
          flags={end.flags}
          endLines={content.endLines}
          shareText={content.shareText}
          issueSlug={content.issueSlug}
          issueLabel={content.eyebrow}
          seed={seed}
          inputs={sessionRef.current?.inputs ?? []}
          totalTicks={ROUND_TICKS}
          onPlayAgain={playAgain}
        />
      )}
    </div>
  );
}
