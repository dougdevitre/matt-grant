import { describe, it, expect } from "vitest";
import { meterAria } from "./meterAria";

describe("meterAria", () => {
  it("derives width % and aria from value/max", () => {
    const { width, attrs } = meterAria({ value: 25, max: 100, label: "Raised" });
    expect(width).toBe("25%");
    expect(attrs).toMatchObject({
      role: "progressbar",
      "aria-label": "Raised",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": 25,
      "aria-valuetext": "25%",
    });
  });

  it("clamps out-of-range values to [0, max]", () => {
    expect(meterAria({ value: 140, max: 100, label: "x" }).width).toBe("100%");
    expect(meterAria({ value: -5, max: 100, label: "x" }).width).toBe("0%");
    expect(meterAria({ value: 140, max: 100, label: "x" }).attrs["aria-valuenow"]).toBe(100);
  });

  it("scales to a non-100 max (e.g. dollars/cents)", () => {
    const { width, attrs } = meterAria({ value: 30, max: 120, label: "Media spend", valueText: "$30" });
    expect(width).toBe("25%");
    expect(attrs["aria-valuemax"]).toBe(120);
    expect(attrs["aria-valuenow"]).toBe(30);
    expect(attrs["aria-valuetext"]).toBe("$30"); // caller text wins over the % default
  });

  it("handles a zero max without NaN", () => {
    expect(meterAria({ value: 5, max: 0, label: "x" }).width).toBe("0%");
  });
});
