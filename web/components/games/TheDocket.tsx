"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createLiveSession, DEFAULT_DT_MS, type LiveSession } from "@/lib/games/engine";
import { buildTheDocket, docketConfig, parseMaze, type DocketInput, type DocketState } from "@/lib/games/the-docket";
import type { Dir } from "@/lib/games/the-docket";
import type { GameContent } from "@/lib/games/content-schema";
import { EndScreen } from "./EndScreen";
import { useGameStartTelemetry } from "@/lib/games/telemetry-client";

// The Docket — Pac-Man-style maze view (PHASE 1: one maze, one ghost). The sim is the
// shared deterministic engine; this view renders the grid, takes turn inputs (arrows /
// WASD / on-screen pad), and records them for replay-validated scoring. Display
// positions ease toward the grid cells so movement reads smooth, not steppy.

type Phase = "ready" | "playing" | "over";
interface EndData { score: number; ceiling: number; flags: string[]; moralInjury: number; stage: number; cleared: boolean }

const ROUND_TICKS = docketConfig.roundTicks;
const STAGES = docketConfig.stages;
const MAZE = parseMaze(docketConfig.maze);
const CELL = 24; // px per maze cell
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
};

// PHASE 4 ending — the moral-injury beat (the toll the maze can't undo) followed by the
// reform plan. The plan's policy steps come ONLY from the documented platform (content
// data, tone-linted); the framing/CTA beats carry no policy. Shown on every game-over so
// the thesis ("reform is the only real win") lands whether you clear all ten or get caught.
function DocketEnding({ end, ending }: { end: EndData; ending: NonNullable<GameContent["ending"]> }) {
  return (
    <section className="space-y-6 rounded-lg border border-brick/30 bg-white p-6 shadow-card" aria-labelledby="docket-reform-heading">
      <div>
        <p className="eyebrow text-brick">{end.cleared ? "All ten cleared" : `Caught at stage ${end.stage}/${STAGES}`}</p>
        <p className="mt-2 text-lg font-semibold text-ink">{end.cleared ? ending.beatWon : ending.beatLost}</p>
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="eyebrow text-slate">Moral injury</span>
            <span className="font-mono tabular-nums text-brick">{end.moralInjury}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Moral injury" aria-valuenow={end.moralInjury} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brick" style={{ width: `${end.moralInjury}%` }} />
          </div>
        </div>
        <div className="mt-4 space-y-1">
          {ending.body.map((line) => (
            <p key={line} className="text-sm text-slate">{line}</p>
          ))}
        </div>
      </div>
      <div>
        <h3 id="docket-reform-heading" className="text-base font-semibold text-ink">{ending.reformHeading}</h3>
        <ol className="mt-3 space-y-3">
          {ending.reformPlan.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brick text-xs font-bold tabular-nums text-paper" aria-hidden="true">{i + 1}</span>
              <span className="text-sm">
                <span className="font-semibold text-ink">{step.title}</span> <span className="text-slate">— {step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <a href={ending.cta.href} className="btn-brick inline-block">{ending.cta.label} →</a>
    </section>
  );
}

export function TheDocket({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  useGameStartTelemetry(phase === "playing", content.gameId);
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  const sessionRef = useRef<LiveSession<DocketState, DocketInput> | null>(null);
  const gameRef = useRef(buildTheDocket());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  // Eased display positions (floats), lerped toward the authoritative grid cells.
  const initDisp = () => ({
    px: MAZE.playerStart.col,
    py: MAZE.playerStart.row,
    ghosts: MAZE.ghostStarts.map((g) => ({ x: g.col, y: g.row })),
  });
  const dispRef = useRef(initDisp());

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finalize = useCallback(() => {
    stopLoop();
    const session = sessionRef.current;
    if (!session) return;
    const st = session.state;
    const local = gameRef.current.score(st);
    setEnd({ score: local.total, ceiling: local.ceiling, flags: local.flags, moralInjury: st.moralInjury, stage: st.stage, cleared: st.cleared });
    setPhase("over");
  }, [stopLoop]);

  const loop = useCallback(
    (ts: number) => {
      const session = sessionRef.current;
      if (!session) return;
      const elapsed = lastTsRef.current ? ts - lastTsRef.current : DEFAULT_DT_MS;
      lastTsRef.current = ts;
      session.advance(elapsed);
      // Ease display toward the sim's grid cells.
      const st = session.state;
      const d = dispRef.current;
      const k = Math.min(1, elapsed / 90); // ~90ms to close the gap
      d.px += (st.player.col - d.px) * k;
      d.py += (st.player.row - d.py) * k;
      st.ghosts.forEach((g, i) => {
        const gd = d.ghosts[i];
        if (!gd) return;
        gd.x += (g.col - gd.x) * k;
        gd.y += (g.row - gd.y) * k;
      });
      repaint();
      if (session.isOver()) return finalize();
      rafRef.current = requestAnimationFrame(loop);
    },
    [finalize],
  );

  const start = useCallback(() => {
    gameRef.current = buildTheDocket();
    sessionRef.current = createLiveSession(gameRef.current, docketConfig, seed);
    lastTsRef.current = 0;
    dispRef.current = initDisp();
    setEnd(null);
    setPhase("playing");
    rafRef.current = requestAnimationFrame(loop);
  }, [seed, loop]);

  const playAgain = useCallback(() => {
    setSeed(newSeed());
    setPhase("ready");
  }, []);

  const turn = useCallback(
    (dir: Dir) => {
      if (phase === "playing") sessionRef.current?.enqueue({ kind: "turn", dir });
    },
    [phase],
  );

  useEffect(() => () => stopLoop(), [stopLoop]);

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.code];
      if (dir) {
        e.preventDefault();
        turn(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, turn]);

  const session = sessionRef.current;
  const state = session?.state;
  const d = dispRef.current;
  const secondsLeft = state ? (ROUND_TICKS - state.tick) * (DEFAULT_DT_MS / 1000) : ROUND_TICKS * (DEFAULT_DT_MS / 1000);

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
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brick">Ten escalating stages · the system is the real boss</p>
          <button onClick={start} className="btn-brick mt-4">Start</button>
        </div>
      )}

      {phase === "playing" && state && (
        <>
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-4" role="status" aria-live="polite">
            <div className="flex flex-col"><span className="eyebrow text-slate">Score</span><span className="font-mono text-lg font-bold tabular-nums text-ink">{state.score.toLocaleString("en-US")}</span></div>
            <div className="flex flex-col"><span className="eyebrow text-slate">Stage</span><span className="font-mono text-lg font-bold tabular-nums text-ink">{state.stage}<span className="text-slate">/{STAGES}</span></span></div>
            <div className="flex flex-col"><span className="eyebrow text-slate">Childhood left</span><span className="font-mono text-lg font-bold tabular-nums text-ink">{state.pellets.size}</span></div>
            <div className="flex flex-col"><span className="eyebrow text-slate">Lives</span><span className="font-mono text-lg font-bold tabular-nums text-ink">{"♥".repeat(Math.max(0, state.lives))}</span></div>
          </div>

          {/* Moral-injury meter — climbs every stage cleared; the maze can't bring it down. */}
          <div className="mx-auto max-w-sm">
            <div className="flex items-baseline justify-between text-xs">
              <span className="eyebrow text-slate">Moral injury</span>
              <span className="font-mono tabular-nums text-brick">{state.moralInjury}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Moral injury" aria-valuenow={state.moralInjury} aria-valuemin={0} aria-valuemax={100}>
              {/* Escalates as it climbs: quiet ink → gold warning → pulsing brick wound. */}
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                  state.moralInjury >= 70 ? "bg-brick animate-pulse motion-reduce:animate-none" : state.moralInjury >= 40 ? "bg-gold" : "bg-ink"
                }`}
                style={{ width: `${state.moralInjury}%` }}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className="relative rounded-md bg-paper shadow-card"
              style={{ width: MAZE.width * CELL, height: MAZE.height * CELL }}
              aria-label="The docket maze"
            >
              {/* walls */}
              {MAZE.walls.flatMap((cols, r) =>
                cols.map((isWall, c) =>
                  isWall ? <span key={`w${c}-${r}`} className="absolute bg-ink" style={{ left: c * CELL, top: r * CELL, width: CELL, height: CELL }} aria-hidden="true" /> : null,
                ),
              )}
              {/* pellets (childhood) */}
              {[...state.pellets].map((key) => {
                const [c, r] = key.split(",").map(Number);
                return <span key={`p${key}`} className="absolute rounded-full bg-gold" style={{ left: c * CELL + CELL / 2 - 3, top: r * CELL + CELL / 2 - 3, width: 6, height: 6 }} aria-hidden="true" />;
              })}
              {/* power pellets (Reforms) */}
              {[...state.powerPellets].map((key) => {
                const [c, r] = key.split(",").map(Number);
                return <span key={`o${key}`} className="absolute animate-pulse rounded-full border-2 border-gold bg-gold/40 motion-reduce:animate-none" style={{ left: c * CELL + CELL / 2 - 6, top: r * CELL + CELL / 2 - 6, width: 12, height: 12 }} aria-hidden="true" />;
              })}
              {/* ghosts (the system's mechanisms) — frightened (edible) when a Reform is active */}
              {state.ghosts.map((g, i) => {
                if (g.eaten) return null;
                const gd = d.ghosts[i] ?? { x: g.col, y: g.row };
                return (
                  <span
                    key={`g${i}`}
                    className={`absolute grid place-items-center rounded-t-full text-paper ${g.frightened ? "bg-slate" : "bg-brick"}`}
                    style={{ left: gd.x * CELL + 2, top: gd.y * CELL + 2, width: CELL - 4, height: CELL - 4, fontSize: 10 }}
                    aria-hidden="true"
                  >
                    {g.frightened ? "✦" : "▼"}
                  </span>
                );
              })}
              {/* player (the advocate) */}
              <span className="absolute grid place-items-center rounded-full bg-ink text-paper" style={{ left: d.px * CELL + 2, top: d.py * CELL + 2, width: CELL - 4, height: CELL - 4, fontSize: 11 }} aria-hidden="true">●</span>
            </div>
          </div>

          <p className="text-center text-xs text-slate">
            Time {Math.max(0, Math.ceil(secondsLeft))}s —{" "}
            {state.powerTicksLeft > 0
              ? `⚡ Reform active ${Math.ceil(state.powerTicksLeft * (DEFAULT_DT_MS / 1000))}s — push the system back`
              : state.lastEvent === "stage"
                ? `Stage cleared — a larger assignment begins (stage ${state.stage}/${STAGES})`
                : state.lastEvent === "caught"
                  ? "✗ The system caught you"
                  : "Arrow keys / WASD to move"}
          </p>

          {/* on-screen pad for touch */}
          <div className="mx-auto grid w-52 grid-cols-3 gap-2 sm:w-40 sm:gap-1" role="group" aria-label="Move">
            <span />
            <button onClick={() => turn("up")} className="btn-ghost py-3 text-lg sm:py-2 sm:text-base" aria-label="Move up">↑</button>
            <span />
            <button onClick={() => turn("left")} className="btn-ghost py-3 text-lg sm:py-2 sm:text-base" aria-label="Move left">←</button>
            <button onClick={() => turn("down")} className="btn-ghost py-3 text-lg sm:py-2 sm:text-base" aria-label="Move down">↓</button>
            <button onClick={() => turn("right")} className="btn-ghost py-3 text-lg sm:py-2 sm:text-base" aria-label="Move right">→</button>
          </div>
        </>
      )}

      {phase === "over" && end && content.ending && <DocketEnding end={end} ending={content.ending} />}

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
