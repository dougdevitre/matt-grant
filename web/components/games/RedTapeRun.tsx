"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createLiveSession,
  comboMultiplier,
  DEFAULT_DT_MS,
  EFFECTIVE_DT_MS,
  type LiveSession,
} from "@/lib/games/engine";
import {
  buildRedTapeRun,
  redTapeRunConfig,
  type RedTapeRunInput,
  type RedTapeRunState,
  type RunEntity,
} from "@/lib/games/red-tape-run";
import type { GameContent } from "@/lib/games/content-schema";
import { EndScreen } from "./EndScreen";
import { useGameStartTelemetry } from "@/lib/games/telemetry-client";
import { useSfx } from "@/lib/games/juice/sfx";
import { MuteButton } from "./juice/MuteButton";
import { useGameEffects } from "./juice/GameEffects";
import { useShake } from "./juice/useShake";
import { useCountUp } from "./juice/useCountUp";
import { StartCountdown } from "./juice/StartCountdown";

// Red Tape Run — a Pitfall-style runner. The sim is the shared deterministic engine;
// this view renders the side-scrolling track, takes one input (JUMP), and records it
// for the same-replay score validation. This is the "flagship" polished view: the sim
// runs at a fixed tick rate but everything on screen is interpolated to 60fps, with
// particle/score juice, screen shake, a run-cycle character, parallax depth, animated
// HUD, a 3·2·1 countdown, and synthesized SFX.

type Phase = "ready" | "countdown" | "playing" | "over";

interface EndData {
  score: number;
  ceiling: number;
  flags: string[];
  isBest: boolean;
}

const cfg = redTapeRunConfig;
const ROUND_TICKS = cfg.roundTicks;
const BEST_KEY = "mg-rtr-best";
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

// Render mapping (world units → CSS).
const PLAYER_LEFT_PCT = 14;
const RENDER_AHEAD = 230; // world units visible ahead of the player
const VSCALE = 1.35; // px per world y-unit at the design track height
const DESIGN_TRACK_H = 260;
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function RedTapeRun({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  useGameStartTelemetry(phase === "playing", content.gameId);
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const [hitFlash, setHitFlash] = useState(false);

  const sfx = useSfx();
  const fx = useGameEffects();
  const { shaking, shake } = useShake(280);

  const sessionRef = useRef<LiveSession<RedTapeRunState, RedTapeRunInput> | null>(null);
  const gameRef = useRef(buildRedTapeRun());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  // Interpolation: keep the position at the previous and current tick, then render
  // the lerp by the session's sub-tick alpha so 15Hz sim reads as 60fps motion.
  const tickRef = useRef(0);
  const prevPosRef = useRef({ worldX: 0, y: 0 });
  const curPosRef = useRef({ worldX: 0, y: 0 });
  // Event edges for juice/SFX (compare sim counters frame-to-frame).
  const evRef = useRef({ grounded: true, reforms: 0, cleared: 0, hits: 0, streak: 0, score: 0 });

  const trackRef = useRef<HTMLButtonElement | null>(null);
  const [trackH, setTrackH] = useState(DESIGN_TRACK_H);
  const vscale = (VSCALE * trackH) / DESIGN_TRACK_H;

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finalize = useCallback(() => {
    stopLoop();
    const session = sessionRef.current;
    if (!session) return;
    const local = gameRef.current.score(session.state);
    let isBest = false;
    try {
      const prevBest = Number(window.localStorage.getItem(BEST_KEY) ?? "0");
      if (local.total > prevBest) {
        isBest = local.total > 0;
        window.localStorage.setItem(BEST_KEY, String(local.total));
      }
    } catch {
      /* ignore storage errors */
    }
    sfx.play("gameover");
    setEnd({ score: local.total, ceiling: local.ceiling, flags: local.flags, isBest });
    setPhase("over");
  }, [stopLoop, sfx]);

  // React to the authoritative sim counters changing (juice + SFX only — no sim coupling).
  const reactToState = useCallback(
    (s: RedTapeRunState) => {
      const ev = evRef.current;
      const playerBottom = GROUND_PX + s.y * vscale + 18;
      if (s.grounded && !ev.grounded) {
        sfx.play("land");
        fx.spawnBurst({ xPct: PLAYER_LEFT_PCT, bottomPx: GROUND_PX, tone: "good", count: 6 });
      }
      if (s.reformsCollected > ev.reforms) {
        sfx.play("collect");
        fx.spawnBurst({ xPct: PLAYER_LEFT_PCT, bottomPx: playerBottom, tone: "gold", count: 10 });
        fx.spawnFloat({ xPct: PLAYER_LEFT_PCT, bottomPx: playerBottom, text: "＋REFORM", tone: "gold" });
      }
      if (s.abusesCleared > ev.cleared) {
        fx.spawnFloat({ xPct: PLAYER_LEFT_PCT, bottomPx: playerBottom, text: "DODGED", tone: "good" });
      }
      if (s.abusesHit > ev.hits) {
        sfx.play("hit");
        shake();
        setHitFlash(true);
        setTimeout(() => setHitFlash(false), 220);
        fx.spawnFloat({ xPct: PLAYER_LEFT_PCT, bottomPx: playerBottom, text: "−INTEGRITY", tone: "bad" });
      }
      // Combo milestones — a rising chime every few in a streak.
      if (s.streak > ev.streak && s.streak > 0 && s.streak % cfg.scoring.combo.stepEvery === 0) {
        sfx.play("combo", Math.floor(s.streak / cfg.scoring.combo.stepEvery));
        fx.spawnFloat({ xPct: PLAYER_LEFT_PCT + 6, bottomPx: playerBottom + 22, text: `COMBO ×${s.streak}`, tone: "gold" });
      }
      ev.grounded = s.grounded;
      ev.reforms = s.reformsCollected;
      ev.cleared = s.abusesCleared;
      ev.hits = s.abusesHit;
      ev.streak = s.streak;
      ev.score = s.score;
    },
    [fx, sfx, shake, vscale],
  );

  const loop = useCallback(
    (ts: number) => {
      const session = sessionRef.current;
      if (!session) return;
      const elapsed = lastTsRef.current ? ts - lastTsRef.current : DEFAULT_DT_MS;
      lastTsRef.current = ts;
      const stepped = session.advance(elapsed);
      const st = session.state;
      // Advance interpolation samples once per whole tick crossed.
      if (stepped > 0 && st.tick !== tickRef.current) {
        prevPosRef.current = curPosRef.current;
        curPosRef.current = { worldX: st.worldX, y: st.y };
        tickRef.current = st.tick;
        reactToState(st);
      }
      repaint();
      if (session.isOver()) {
        finalize();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [finalize, reactToState],
  );

  const createSession = useCallback(() => {
    gameRef.current = buildRedTapeRun();
    sessionRef.current = createLiveSession(gameRef.current, cfg, seed);
    lastTsRef.current = 0;
    tickRef.current = 0;
    prevPosRef.current = { worldX: 0, y: 0 };
    curPosRef.current = { worldX: 0, y: 0 };
    evRef.current = { grounded: true, reforms: 0, cleared: 0, hits: 0, streak: 0, score: 0 };
    fx.clear();
    setEnd(null);
  }, [seed, fx]);

  // Start = arm the session (so the opening scene renders under the countdown),
  // then hand off to the countdown, which kicks the loop when it finishes.
  const beginCountdown = useCallback(() => {
    sfx.unlock();
    sfx.play("uiClick");
    createSession();
    setPhase("countdown");
  }, [createSession, sfx]);

  const beginPlay = useCallback(() => {
    lastTsRef.current = 0;
    setPhase("playing");
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const playAgain = useCallback(() => {
    setSeed(newSeed());
    setPhase("ready");
  }, []);

  const jump = useCallback(() => {
    if (phase !== "playing") return;
    const s = sessionRef.current?.state;
    if (s?.grounded) sfx.play("jump");
    sessionRef.current?.enqueue({ kind: "jump" });
  }, [phase, sfx]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  // Keep trackH in sync with the rendered (responsive) track.
  useEffect(() => {
    if (phase !== "playing" && phase !== "countdown") return;
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackH(el.clientHeight || DESIGN_TRACK_H);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

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
  const alpha = session?.alpha ?? 0;

  // Interpolated render position.
  const showTrack = (phase === "playing" || phase === "countdown") && state;
  const iWorldX = lerp(prevPosRef.current.worldX, curPosRef.current.worldX, phase === "playing" ? alpha : 0);
  const iY = lerp(prevPosRef.current.y, curPosRef.current.y, phase === "playing" ? alpha : 0);

  const secondsLeft = state ? (ROUND_TICKS - state.tick) * (EFFECTIVE_DT_MS / 1000) : ROUND_TICKS * (EFFECTIVE_DT_MS / 1000);
  const displayScore = useCountUp(state?.score ?? 0, 350);
  const mult = state ? comboMultiplier(state.streak, cfg.scoring.combo) : 1;

  // Visible slice of the track (entities ahead of the interpolated player).
  const visible: { e: RunEntity; delta: number }[] = [];
  if (state) {
    for (let i = state.nextIdx; i < state.entities.length; i++) {
      const delta = state.entities[i].worldPos - iWorldX;
      if (delta > RENDER_AHEAD) break;
      if (delta < -16) continue;
      visible.push({ e: state.entities[i], delta });
    }
  }

  // Runner squash/stretch from vertical velocity for game feel.
  const vy = state?.vy ?? 0;
  const grounded = state?.grounded ?? true;
  const scaleY = grounded ? 1 : Math.max(0.82, Math.min(1.18, 1 + vy * 0.012));
  const scaleX = 2 - scaleY;
  const shadowScale = Math.max(0.4, 1 - iY / 90);

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
          <button onClick={beginCountdown} className="btn-brick mt-6">
            Start
          </button>
        </div>
      )}

      {showTrack && (
        <>
          {/* HUD */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-4" role="status" aria-live="off">
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Score</span>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">{displayScore.toLocaleString("en-US")}</span>
            </div>
            <div className="flex flex-col">
              <span className="eyebrow text-slate">Combo</span>
              <span className={`font-mono text-lg font-bold tabular-nums ${mult > 1 ? "text-gold" : "text-slate"}`}>
                ×{mult}
                {state && state.streak > 0 ? <span className="ml-1 text-xs text-slate">({state.streak})</span> : null}
              </span>
            </div>
            <div className="col-span-2 flex flex-col">
              <span className="eyebrow text-slate">Integrity {state && state.integrity < 40 ? "— low" : ""}</span>
              <span className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span
                  className={`block h-full rounded-full transition-[width] duration-200 ${
                    state && state.integrity < 40 ? "rtr-pulse bg-gradient-to-r from-brick to-brick/70" : "bg-gradient-to-r from-field to-ink"
                  }`}
                  style={{ width: `${state?.integrity ?? 100}%` }}
                />
              </span>
            </div>
          </div>

          {/* The track. Clicking it (or Space/↑) jumps. */}
          <button
            ref={trackRef}
            type="button"
            onClick={jump}
            aria-label="Jump (or press Space / Up arrow)"
            className={`rtr-track relative block h-[190px] w-full overflow-hidden rounded-lg border border-line text-left shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink sm:h-[230px] md:h-[260px] ${
              shaking ? "rtr-shake" : ""
            }`}
          >
            {/* sky + parallax layers */}
            <span className="absolute inset-0 bg-gradient-to-b from-[#eef3fb] to-paper" aria-hidden="true" />
            <span
              className="rtr-far absolute inset-x-0 bottom-[26px] h-24 opacity-40"
              style={{ backgroundPositionX: `${-iWorldX * 0.25}px` }}
              aria-hidden="true"
            />
            <span
              className="rtr-near absolute inset-x-0 bottom-[26px] h-16 opacity-60"
              style={{ backgroundPositionX: `${-iWorldX * 0.55}px` }}
              aria-hidden="true"
            />

            {/* ground */}
            <span className="absolute inset-x-0 bottom-0 border-t border-line bg-white" style={{ height: GROUND_PX }} aria-hidden="true" />
            <span
              className="rtr-ground absolute inset-x-0 bottom-0"
              style={{ height: GROUND_PX, backgroundPositionX: `${-iWorldX}px` }}
              aria-hidden="true"
            />

            {/* shadow */}
            <span
              className="absolute z-0 h-2 -translate-x-1/2 rounded-[100%] bg-ink/25"
              style={{ left: `${PLAYER_LEFT_PCT}%`, bottom: GROUND_PX - 3, width: 26 * shadowScale, opacity: 0.28 * shadowScale }}
              aria-hidden="true"
            />

            {/* runner */}
            <span
              className={`absolute z-10 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-sm bg-ink text-paper ${
                grounded && phase === "playing" ? "rtr-run" : ""
              }`}
              style={{ left: `${PLAYER_LEFT_PCT}%`, bottom: GROUND_PX + iY * vscale, transform: `translateX(-50%) scale(${scaleX}, ${scaleY})` }}
              aria-hidden="true"
            >
              <span className="text-base leading-none">🏃</span>
            </span>

            {/* entities */}
            {visible.map(({ e, delta }) => {
              const leftPct = PLAYER_LEFT_PCT + (delta / RENDER_AHEAD) * (100 - PLAYER_LEFT_PCT);
              const label = entityLabel(e, content);
              const labelOpacity = Math.max(0, Math.min(1, (RENDER_AHEAD - delta) / 70));
              if (e.kind === "abuse") {
                return (
                  <span
                    key={e.id}
                    className="absolute z-[5] flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${leftPct}%`, bottom: GROUND_PX }}
                    aria-hidden="true"
                  >
                    <span
                      className="mb-1 max-w-[8rem] rounded-full border border-brick/30 bg-white/95 px-2 py-0.5 text-center text-[0.7rem] font-semibold leading-tight text-brick shadow-sm"
                      style={{ opacity: labelOpacity }}
                    >
                      {label}
                    </span>
                    <span className="flex h-14 w-8 items-end justify-center rounded-sm border-2 border-brick bg-brick/10 pb-0.5 text-lg text-brick">
                      ⚠
                    </span>
                  </span>
                );
              }
              return (
                <span
                  key={e.id}
                  className="absolute z-[5] flex -translate-x-1/2 flex-col items-center"
                  style={{ left: `${leftPct}%`, bottom: GROUND_PX }}
                  aria-hidden="true"
                >
                  <span
                    className="mb-1 max-w-[8rem] rounded-full border border-gold/40 bg-white/95 px-2 py-0.5 text-center text-[0.7rem] font-semibold leading-tight text-ink shadow-sm"
                    style={{ opacity: labelOpacity }}
                  >
                    {label}
                  </span>
                  <span className="rtr-token grid h-8 w-8 place-items-center rounded-full border-2 border-gold bg-gold/15 text-lg text-ink">
                    ＋
                  </span>
                </span>
              );
            })}

            {/* juice layer (particles + floating text) */}
            {fx.render}

            {/* hit flash */}
            {hitFlash && <span className="pointer-events-none absolute inset-0 z-[15] bg-brick/25" aria-hidden="true" />}

            {/* countdown */}
            {phase === "countdown" && <StartCountdown onDone={beginPlay} onTick={(i) => sfx.play(i >= 3 ? "powerup" : "uiClick")} />}

            {/* timer */}
            <span className="absolute right-3 top-2 rounded-full bg-white/85 px-2 py-0.5 font-mono text-xs tabular-nums text-slate shadow-sm" aria-hidden="true">
              {Math.max(0, Math.ceil(secondsLeft))}s
            </span>
          </button>

          <div className="flex items-center justify-between gap-3">
            <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="polite">
              {state?.lastOutcome ? OUTCOME_TEXT[state.lastOutcome] : ""}
            </p>
            <div className="flex items-center gap-2">
              <MuteButton />
              <button onClick={jump} className="btn-ink" aria-label="Jump" disabled={phase !== "playing"}>
                Jump ⤒
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "over" && end && (
        <div className="relative">
          {end.isBest && <BestConfetti />}
          <EndScreen
            gameId={content.gameId}
            title={content.title}
            score={end.score}
            ceiling={end.ceiling}
            flags={end.isBest ? ["personal_best", ...end.flags] : end.flags}
            endLines={content.endLines}
            shareText={content.shareText}
            issueSlug={content.issueSlug}
            issueLabel={content.eyebrow}
            seed={seed}
            inputs={sessionRef.current?.inputs ?? []}
            totalTicks={ROUND_TICKS}
            onPlayAgain={playAgain}
          />
        </div>
      )}

      <style jsx>{`
        .rtr-far {
          background-image: repeating-linear-gradient(90deg, transparent 0 46px, rgba(22, 54, 92, 0.5) 46px 60px);
          background-repeat: repeat-x;
        }
        .rtr-near {
          background-image: repeating-linear-gradient(90deg, transparent 0 28px, rgba(15, 37, 64, 0.45) 28px 40px);
          background-repeat: repeat-x;
        }
        .rtr-ground {
          background-image: repeating-linear-gradient(90deg, rgba(15, 37, 64, 0.18) 0 2px, transparent 2px 40px);
          background-repeat: repeat-x;
        }
        .rtr-run {
          animation: rtr-run 0.32s steps(2) infinite;
        }
        @keyframes rtr-run {
          0% {
            filter: none;
          }
          50% {
            filter: brightness(1.15);
          }
        }
        .rtr-token {
          animation: rtr-bob 1.1s ease-in-out infinite;
        }
        @keyframes rtr-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .rtr-shake {
          animation: rtr-shake 0.28s ease-in-out;
        }
        @keyframes rtr-shake {
          0%,
          100% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(-4px, 2px);
          }
          40% {
            transform: translate(4px, -2px);
          }
          60% {
            transform: translate(-3px, 1px);
          }
          80% {
            transform: translate(3px, -1px);
          }
        }
        .rtr-pulse {
          animation: rtr-pulse 0.8s ease-in-out infinite;
        }
        @keyframes rtr-pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .rtr-run,
          .rtr-token,
          .rtr-shake,
          .rtr-pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

// Lightweight confetti for a new personal best — pure CSS, self-contained, and
// disabled under reduced motion.
function BestConfetti() {
  const bits = Array.from({ length: 28 }, (_, i) => i);
  const colors = ["#B5343B", "#2563EB", "#6BA6FF", "#0F2540", "#16365C"];
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 h-0" aria-hidden="true">
      {bits.map((i) => (
        <span
          key={i}
          className="bc-bit absolute top-0 h-2 w-2 rounded-[1px]"
          style={
            {
              left: `${(i / bits.length) * 100}%`,
              background: colors[i % colors.length],
              ["--x" as string]: `${(Math.random() * 2 - 1) * 60}px`,
              animationDelay: `${(i % 7) * 60}ms`,
            } as React.CSSProperties
          }
        />
      ))}
      <style jsx>{`
        .bc-bit {
          animation: bc-fall 1200ms ease-in forwards;
        }
        @keyframes bc-fall {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(var(--x), 220px) rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bc-bit {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
