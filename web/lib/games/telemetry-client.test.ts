import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@/lib/analytics";
import { emitGameEvent } from "./telemetry-client";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

describe("emitGameEvent → analytics sink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps game_start to a clean GA event", () => {
    emitGameEvent({ t: "game_start", gameId: "the-docket" });
    expect(track).toHaveBeenCalledWith("game_start", { game_id: "the-docket" });
  });

  it("flattens game_complete flags to a scalar string (GA rejects arrays)", () => {
    emitGameEvent({ t: "game_complete", gameId: "the-docket", score: 4242, flags: ["cleared", "moral_injury"] });
    expect(track).toHaveBeenCalledWith("game_complete", {
      game_id: "the-docket",
      score: 4242,
      flags: "cleared,moral_injury",
    });
  });

  it("uses 'none' when there are no flags, and includes duration only when given", () => {
    emitGameEvent({ t: "game_complete", gameId: "rotation", score: 0, flags: [] });
    expect(track).toHaveBeenLastCalledWith("game_complete", { game_id: "rotation", score: 0, flags: "none" });
    emitGameEvent({ t: "game_complete", gameId: "rotation", score: 10, durationMs: 1500, flags: [] });
    expect(track).toHaveBeenLastCalledWith("game_complete", { game_id: "rotation", score: 10, flags: "none", duration_ms: 1500 });
  });

  it("maps conversion + anti-cheat events", () => {
    emitGameEvent({ t: "optin_submit", gameId: "cut-and-save", channel: "sms" });
    expect(track).toHaveBeenCalledWith("game_optin", { game_id: "cut-and-save", channel: "sms" });
    emitGameEvent({ t: "issue_clickthrough", gameId: "cut-and-save" });
    expect(track).toHaveBeenCalledWith("game_issue_click", { game_id: "cut-and-save" });
    emitGameEvent({ t: "score_rejected", gameId: "org-chart", reason: "ceiling" });
    expect(track).toHaveBeenCalledWith("game_score_rejected", { game_id: "org-chart", reason: "ceiling" });
  });
});
