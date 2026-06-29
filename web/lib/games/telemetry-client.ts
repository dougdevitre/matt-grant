"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import type { GameEvent } from "@/lib/games/engine/telemetry";

// Routes the typed arcade telemetry taxonomy (lib/games/engine/telemetry) to the site's
// analytics sink. track() (lib/analytics) forwards to GA4/gtag when present (live in prod
// via NEXT_PUBLIC_GA_MEASUREMENT_ID) and is a no-op otherwise, so this never breaks
// gameplay and reports the moment a provider is on the page.
//
// Event names are GA4-friendly: snake_case, "game_" prefixed so they group in reports.
// Props are scalars only (GA4 rejects arrays/objects), so flags are joined to a string.
export function emitGameEvent(e: GameEvent): void {
  switch (e.t) {
    case "game_start":
      return track("game_start", { game_id: e.gameId });
    case "game_complete":
      return track("game_complete", {
        game_id: e.gameId,
        score: e.score,
        flags: e.flags.length ? e.flags.join(",") : "none",
        ...(e.durationMs != null ? { duration_ms: e.durationMs } : {}),
      });
    case "replay_attempt":
      return track("game_replay", { game_id: e.gameId });
    case "share_click":
      return track("game_share", { game_id: e.gameId });
    case "optin_submit":
      return track("game_optin", { game_id: e.gameId, channel: e.channel });
    case "issue_clickthrough":
      return track("game_issue_click", { game_id: e.gameId });
    case "score_rejected":
      return track("game_score_rejected", { game_id: e.gameId, reason: e.reason });
  }
}

// Fire game_start once each time a game enters its "playing" phase. `active` is
// `phase === "playing"`; the effect re-fires whenever a fresh round begins (Play
// again → ready → playing), giving an accurate start count (the funnel denominator).
export function useGameStartTelemetry(active: boolean, gameId: string): void {
  useEffect(() => {
    if (active) emitGameEvent({ t: "game_start", gameId });
  }, [active, gameId]);
}
