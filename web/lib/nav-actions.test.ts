import { describe, it, expect } from "vitest";
import { primaryAction, secondaryAction } from "@/lib/nav-actions";

describe("primaryAction", () => {
  it("pushes turnout for everyone during GOTV", () => {
    const a = primaryAction("gotv", "donor");
    expect(a.label).toBe("Plan your vote");
    expect(a.href).toBe("/vote");
    expect(a.external).toBe(false);
  });

  it("offers returning donors a warmer ask outside GOTV", () => {
    const a = primaryAction("campaign", "donor");
    expect(a.label).toBe("Give again");
    expect(a.external).toBe(true);
    expect(a.context).toBe("donate");
  });

  it("defaults to Donate for everyone else", () => {
    for (const role of [null, "supporter", "staff"]) {
      expect(primaryAction("campaign", role).label).toBe("Donate");
    }
    expect(primaryAction("past", null).label).toBe("Donate");
  });

  it("keeps Donate as a secondary ask only during GOTV", () => {
    expect(secondaryAction("campaign", null)).toBeNull();
    expect(secondaryAction("past", "donor")).toBeNull();
    expect(secondaryAction("gotv", null)).toMatchObject({ label: "Donate", external: true });
    expect(secondaryAction("gotv", "donor")?.label).toBe("Give again");
  });
});
