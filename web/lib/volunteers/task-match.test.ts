import { describe, it, expect, vi } from "vitest";

// task-match.ts is `server-only` and imports the airtable client; neutralize both
// so we can unit-test the PURE matcher (matchTasks).
vi.mock("server-only", () => ({}));
vi.mock("@/lib/airtable/client", () => ({ listRecords: vi.fn() }));

import { matchTasks, type MatchableTask } from "./task-match";

const task = (over: Partial<MatchableTask> = {}): MatchableTask => ({
  id: "t", name: "Task", whatTheyDo: "", roles: [], skills: [], commitment: [],
  mode: "Either", availability: [], geo: "", priority: "Medium", effort: "", channel: [],
  ...over,
});

describe("matchTasks", () => {
  it("excludes a hard mode conflict (Digital volunteer ✕ In-person task)", () => {
    const out = matchTasks({ mode: "Digital" }, [task({ id: "a", mode: "In-person" })]);
    expect(out).toHaveLength(0);
  });

  it("does not exclude when either side is 'Either'", () => {
    const out = matchTasks({ mode: "Digital" }, [task({ id: "a", mode: "Either" })]);
    expect(out).toHaveLength(1);
  });

  it("ranks a role match above a non-match", () => {
    const out = matchTasks({ roles: ["Phone Banker"] }, [
      task({ id: "none", name: "Yard signs" }),
      task({ id: "role", name: "Phone bank", roles: ["Phone Banker"] }),
    ]);
    expect(out[0].task.id).toBe("role");
    expect(out[0].reasons[0]).toContain("Phone Banker");
  });

  it("still surfaces tasks for a thin (just-signed-up) profile via the base score", () => {
    const out = matchTasks({}, [task({ id: "a" }), task({ id: "b" })]);
    expect(out).toHaveLength(2);
    expect(out.every((m) => m.score > 0)).toBe(true);
  });

  it("credits availability when the task is anytime/remote", () => {
    const generic = matchTasks({}, [task({ id: "x" })])[0].score;
    const anytime = matchTasks({}, [task({ id: "x", availability: ["Anytime / Remote"] })])[0].score;
    expect(anytime).toBeGreaterThan(generic);
  });

  it("boosts high priority over low", () => {
    const [hi] = matchTasks({}, [task({ priority: "High" })]);
    const [lo] = matchTasks({}, [task({ priority: "Low" })]);
    expect(hi.score).toBeGreaterThan(lo.score);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => task({ id: `t${i}` }));
    expect(matchTasks({}, many, 6)).toHaveLength(6);
  });
});
