import { describe, it, expect } from "vitest";
import {
  toNumber,
  maxAffordable,
  lineTotal,
  formatUSD,
  formatUSD0,
  summarizePlan,
} from "./plan";
import type { Item, QtyMap } from "./types";

// Pure money math behind the public donate "what your gift funds" (DonationImpact).
// A NaN leak or off-by-one shows visibly wrong numbers to donors.

describe("toNumber", () => {
  it("parses currency-ish strings and guards NaN → 0", () => {
    expect(toNumber("$1,234.56")).toBe(1234.56);
    expect(toNumber("-5")).toBe(-5);
    expect(toNumber("")).toBe(0);
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(42)).toBe(42);
  });
});

describe("maxAffordable", () => {
  it("floors the count and guards div-by-zero / negatives", () => {
    expect(maxAffordable(100, 4.25)).toBe(23); // floor(23.52…)
    expect(maxAffordable(100, 0)).toBe(0);
    expect(maxAffordable(100, -1)).toBe(0);
    expect(maxAffordable(0, 5)).toBe(0);
  });
});

describe("lineTotal", () => {
  it("multiplies and clamps qty ≥ 0, sanitizing inputs", () => {
    expect(lineTotal(4.25, 3)).toBeCloseTo(12.75, 5);
    expect(lineTotal(5, -2)).toBe(0); // negative qty clamps to 0
    expect(lineTotal(Number.NaN, 3)).toBe(0); // NaN price → 0
  });
});

describe("formatUSD / formatUSD0", () => {
  it("formats and never emits NaN", () => {
    expect(formatUSD(1234.5)).toBe("$1,234.50");
    expect(formatUSD(Number.NaN)).toBe("$0.00");
    expect(formatUSD0(1234.5)).toBe("$1,235");
    expect(formatUSD0(Number.NaN)).toBe("$0");
  });
});

describe("summarizePlan", () => {
  const items: Item[] = [
    { id: "a", name: "A", category: "Yard Signs", vendor: "", unitPrice: 4, unit: "each", productLink: "", sku: "", minOrderQty: 1 },
    { id: "b", name: "B", category: "Apparel", vendor: "", unitPrice: 10, unit: "each", productLink: "", sku: "", minOrderQty: 1 },
  ];

  it("computes allocated / remaining / pct", () => {
    const qty: QtyMap = { a: 5, b: 2 }; // 20 + 20 = 40
    const s = summarizePlan(items, qty, 100);
    expect(s.allocated).toBe(40);
    expect(s.remaining).toBe(60);
    expect(s.pctAllocated).toBe(40);
  });

  it("guards pctAllocated when available is 0", () => {
    expect(summarizePlan(items, {}, 0).pctAllocated).toBe(0);
  });
});
