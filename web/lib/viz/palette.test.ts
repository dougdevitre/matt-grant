import { describe, it, expect } from "vitest";
import { TURNOUT_RAMP, TURNOUT_LEGEND_GRADIENT, MAP_FALLBACK, DIVERGING } from "./palette";

// Guards the single source of viz color — cheap tripwires so the imminent
// single-hue turnout-ramp swap (or any edit) can't silently break the legend or
// the map, and so every exported color stays a valid hex.
const HEX = /^#[0-9a-fA-F]{6}$/;

describe("viz palette", () => {
  it("turnout ramp is 4 hex stops, light→dark by convention", () => {
    expect(TURNOUT_RAMP).toHaveLength(4);
    for (const c of TURNOUT_RAMP) expect(c).toMatch(HEX);
  });

  it("legend gradient references every ramp stop (so it can't drift from the map)", () => {
    for (const c of TURNOUT_RAMP) expect(TURNOUT_LEGEND_GRADIENT).toContain(c);
  });

  it("fallbacks and the diverging pair are valid hex", () => {
    expect(MAP_FALLBACK.jefferson).toMatch(HEX);
    expect(MAP_FALLBACK.extra).toMatch(HEX);
    expect(DIVERGING.negative).toMatch(HEX);
    expect(DIVERGING.positive).toMatch(HEX);
    expect(DIVERGING.neutral).toMatch(HEX);
  });
});
