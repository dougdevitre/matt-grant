"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createLiveSession, xfnv1a, DEFAULT_DT_MS, type LiveSession } from "@/lib/games/engine";
import {
  buildOrgChart,
  orgChartConfig,
  type OrgBlock,
  type OrgChartInput,
  type OrgChartState,
} from "@/lib/games/org-chart";
import type { GameContent } from "@/lib/games/content-schema";
import { OrgChartHud } from "./OrgChartHud";
import { EndScreen } from "./EndScreen";

// Org Chart — the client view. Drives the shared engine with a rAF loop, records every
// input, and submits (seed, inputs) to /api/games/score for the same-replay validation.
// The player reads each role's category label and decides whether it's bloat to cut or
// a person/infrastructure to protect — that judgment is the skill.

type Phase = "ready" | "playing" | "over";

interface EndData {
  score: number;
  ceiling: number;
  rank: number | null;
  flags: string[];
}

const ROUND_TICKS = orgChartConfig.roundTicks;
const BAND = orgChartConfig.targetBand;
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

function labelFor(block: OrgBlock, content: GameContent): string {
  const pool = content.itemLabels[block.type] ?? [block.type];
  return pool[xfnv1a(block.id) % pool.length];
}

export function OrgChart({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  const sessionRef = useRef<LiveSession<OrgChartState, OrgChartInput> | null>(null);
  const gameRef = useRef(buildOrgChart());
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
    gameRef.current = buildOrgChart();
    sessionRef.current = createLiveSession(gameRef.current, orgChartConfig, seed);
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
    (input: OrgChartInput) => {
      const session = sessionRef.current;
      if (!session || phase !== "playing") return;
      if (input.kind === "cut") {
        const block = session.state.board.find((b) => b.id === input.id);
        if (block) {
          if (block.type === "redundant" || block.type === "bloat") setFeedback("✓ Trimmed bloat");
          else if (block.type === "protected") setFeedback("✗ That's a family service — service lost");
          else setFeedback("✗ Critical infrastructure — service lost");
        }
      } else if (input.kind === "freeze") {
        setFeedback("⏸ Hiring freeze");
      } else {
        setFeedback("Early retirement — bloat cleared, people spared");
      }
      session.enqueue(input);
    },
    [phase],
  );

  const session = sessionRef.current;
  const state = session?.state;
  const secondsLeft = state
    ? (ROUND_TICKS - state.tick) * (DEFAULT_DT_MS / 1000)
    : ROUND_TICKS * (DEFAULT_DT_MS / 1000);
  const freezeReady = state ? state.tick >= state.freezeReadyAt : true;
  const retireLeft = state ? orgChartConfig.retireMaxUses - state.retireUsed : orgChartConfig.retireMaxUses;

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
          <OrgChartHud
            headcount={state.headcount}
            band={BAND}
            serviceLevel={state.serviceLevel}
            serviceFloor={orgChartConfig.serviceFloor}
            secondsLeft={secondsLeft}
          />

          <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="assertive">
            {feedback}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => act({ kind: "freeze" })}
              disabled={!freezeReady}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              Hiring freeze {freezeReady ? "" : "(cooldown)"}
            </button>
            <button
              onClick={() => act({ kind: "retire" })}
              disabled={retireLeft <= 0}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              Early retirement ({Math.max(0, retireLeft)} left)
            </button>
          </div>

          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            role="group"
            aria-label="Roles on the org chart — cut bloat, protect people and infrastructure"
          >
            {state.board.map((block) => {
              const label = labelFor(block, content);
              return (
                <button
                  key={block.id}
                  onClick={() => act({ kind: "cut", id: block.id })}
                  className="flex items-center justify-between rounded-lg border border-line bg-white p-3 text-left text-sm font-semibold text-ink shadow-card transition-transform active:translate-y-px motion-reduce:active:translate-y-0"
                  aria-label={`Cut role: ${label}`}
                >
                  <span>{label}</span>
                  <span aria-hidden="true" className="ml-2 text-brick">
                    ✂
                  </span>
                </button>
              );
            })}
            {state.board.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate">No open roles right now.</p>
            )}
          </div>
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
