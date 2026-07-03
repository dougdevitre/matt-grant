import { describe, it, expect } from "vitest";
import { dollars, dollarsExact, FEC_INDIVIDUAL_PER_ELECTION_CENTS } from "./money";

// These render donor-facing dollar figures (donate, my-giving, community). A ÷100
// or rounding regression would show wrong money publicly — pin the behavior.

describe("dollars (whole-dollar)", () => {
  it("formats cents → whole USD", () => {
    expect(dollars(0)).toBe("$0");
    expect(dollars(100)).toBe("$1");
    expect(dollars(350000)).toBe("$3,500");
    expect(dollars(123456)).toBe("$1,235"); // 1234.56 rounds to 1,235
  });
});

describe("dollarsExact (cents shown)", () => {
  it("formats cents → USD with two decimals", () => {
    expect(dollarsExact(0)).toBe("$0.00");
    expect(dollarsExact(150)).toBe("$1.50");
    expect(dollarsExact(123456)).toBe("$1,234.56");
  });
});

describe("FEC individual limit", () => {
  it("is $3,500 per election (2025–2026 cycle)", () => {
    expect(FEC_INDIVIDUAL_PER_ELECTION_CENTS).toBe(350000);
    expect(dollars(FEC_INDIVIDUAL_PER_ELECTION_CENTS)).toBe("$3,500");
  });
});
