import { describe, it, expect } from "vitest";
import { looksExternal } from "./externalEmail";

describe("looksExternal", () => {
  it("flags government and military domains", () => {
    expect(looksExternal("doge@mail.house.gov")).toBe("gov/mil");
    expect(looksExternal("nathanael.s.tagg.civ@army.mil")).toBe("gov/mil");
    expect(looksExternal("x@senate.gov")).toBe("gov/mil");
  });

  it("flags known press / org domains (and their subdomains)", () => {
    expect(looksExternal("publisher@nytimes.com")).toBe("press/org");
    expect(looksExternal("hancock@missouriindependent.com")).toBe("press/org");
    expect(looksExternal("outreach@aclu-mo.org")).toBe("press/org");
    expect(looksExternal("x@mail.beehiiv.com")).toBe("press/org"); // subdomain
  });

  it("flags role-inbox local-parts on any domain", () => {
    expect(looksExternal("tips@example.com")).toBe("role-addr");
    expect(looksExternal("contact@forthepeople.com")).toBe("role-addr");
    expect(looksExternal("intake@billinginvestigation.com")).toBe("role-addr");
  });

  it("passes ordinary personal addresses", () => {
    for (const e of ["jane.doe@gmail.com", "tedwern@gmail.com", "the.slee.esq@icloud.com", "doug@crystalcleanmo.com"]) {
      expect(looksExternal(e), e).toBe("");
    }
  });

  it("is case-insensitive and trims, and handles malformed input", () => {
    expect(looksExternal("  TIPS@KCSTAR.COM ")).toBe("press/org");
    expect(looksExternal("notanemail")).toBe("");
    expect(looksExternal("")).toBe("");
  });
});
