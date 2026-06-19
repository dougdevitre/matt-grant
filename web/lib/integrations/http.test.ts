import { describe, it, expect } from "vitest";
import { mapLimit } from "@/lib/integrations/http";

describe("mapLimit", () => {
  it("preserves input order and processes every item", async () => {
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it("never runs more than `limit` tasks concurrently", async () => {
    let active = 0;
    let peak = 0;
    await mapLimit([...Array(12).keys()], 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1); // and it is actually concurrent
  });

  it("handles an empty list without spawning workers", async () => {
    expect(await mapLimit([], 4, async (x) => x)).toEqual([]);
  });

  it("passes the index to the mapper", async () => {
    const out = await mapLimit(["a", "b", "c"], 1, async (v, i) => `${i}:${v}`);
    expect(out).toEqual(["0:a", "1:b", "2:c"]);
  });
});
