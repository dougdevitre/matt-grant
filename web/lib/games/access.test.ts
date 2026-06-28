import { describe, it, expect } from "vitest";
import { decideAccess } from "./access";

describe("decideAccess (freemium gate)", () => {
  it("members get every game", () => {
    expect(decideAccess({ signedIn: true, gameId: "org-chart", freeGameId: "cut-and-save" })).toEqual({
      allowed: true,
      reason: "signed_in",
    });
  });

  it("an anonymous visitor with no claim may play this one free", () => {
    expect(decideAccess({ signedIn: false, gameId: "cut-and-save", freeGameId: null })).toEqual({
      allowed: true,
      reason: "free-available",
    });
  });

  it("the already-claimed free game stays playable", () => {
    expect(decideAccess({ signedIn: false, gameId: "cut-and-save", freeGameId: "cut-and-save" })).toEqual({
      allowed: true,
      reason: "free-claimed",
    });
  });

  it("any OTHER game is gated once the free play is spent", () => {
    expect(decideAccess({ signedIn: false, gameId: "rotation", freeGameId: "cut-and-save" })).toEqual({
      allowed: false,
      reason: "gated",
    });
  });

  it("signing in unlocks a game that was gated while anonymous", () => {
    const gated = decideAccess({ signedIn: false, gameId: "rotation", freeGameId: "cut-and-save" });
    const member = decideAccess({ signedIn: true, gameId: "rotation", freeGameId: "cut-and-save" });
    expect(gated.allowed).toBe(false);
    expect(member.allowed).toBe(true);
  });
});
