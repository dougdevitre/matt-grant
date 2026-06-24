import { describe, it, expect, vi, beforeEach } from "vitest";

// Drive the DynamoDB document client with canned, paginated responses dispatched
// by partition key, so we can prove queryAll's pagination terminates and the
// in-code aggregation (sums, status counts, category grouping) is correct.
const send = vi.fn();
vi.mock("@/lib/db", () => ({
  ddb: { send: (c: unknown) => send(c) },
  TABLE: "test-table",
  dbConfigured: true,
  PK: { donors: "DONOR", expenditures: "EXPENDITURE", volunteers: "VOLUNTEER", tasks: "TASK", milestones: "MILESTONE" },
}));

import { getDonors, getFinance, getOverview } from "./queries";

type Page = { Items: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> };
function pageMock(pages: Record<string, Page[]>) {
  const cursor: Record<string, number> = {};
  send.mockImplementation((cmd: { input: { ExpressionAttributeValues: Record<string, string> } }) => {
    const pk = cmd.input.ExpressionAttributeValues[":pk"];
    const i = cursor[pk] ?? 0;
    cursor[pk] = i + 1;
    return Promise.resolve(pages[pk]?.[i] ?? { Items: [] });
  });
}

beforeEach(() => vi.clearAllMocks());

describe("queryAll pagination (via getDonors)", () => {
  it("follows LastEvaluatedKey across pages until exhausted, then aggregates contributions", async () => {
    pageMock({
      DONOR: [
        { Items: [{ SK: "a", name: "A", contributions: [{ amountCents: 500 }, { amountCents: 200 }], createdAt: "2026-01-02" }], LastEvaluatedKey: { SK: "a" } },
        { Items: [{ SK: "b", name: "B", contributions: [{ amountCents: 100 }], createdAt: "2026-01-03" }] }, // no LEK → stop
      ],
    });
    const { connected, rows } = await getDonors();
    expect(connected).toBe(true);
    expect(send).toHaveBeenCalledTimes(2); // exactly two pages, then it stops
    expect(rows).toHaveLength(2);
    // newest first
    expect(rows[0].id).toBe("b");
    expect(rows.find((r) => r.id === "a")!.totalCents).toBe(700);
    expect(rows.find((r) => r.id === "b")!.totalCents).toBe(100);
  });

  it("handles an empty partition without looping", async () => {
    pageMock({ DONOR: [{ Items: [] }] });
    const { rows } = await getDonors();
    expect(rows).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("getFinance", () => {
  it("sums raised + spent and groups expenditures by category, sorted by spend", async () => {
    pageMock({
      DONOR: [{ Items: [{ SK: "d", contributions: [{ amountCents: 1000 }] }] }],
      EXPENDITURE: [
        {
          Items: [
            { SK: "e1", payee: "X", amountCents: 300, category: "Ads", paidAt: "2026-01-01" },
            { SK: "e2", payee: "Y", amountCents: 200, category: "Ads", paidAt: "2026-01-02" },
            { SK: "e3", payee: "Z", amountCents: 600, category: "Ops", paidAt: "2026-01-03" },
          ],
        },
      ],
    });
    const f = await getFinance();
    expect(f.raisedCents).toBe(1000);
    expect(f.spentCents).toBe(1100);
    expect(f.byCategory[0]).toEqual({ category: "Ops", cents: 600 }); // biggest first
    expect(f.byCategory.find((c) => c.category === "Ads")!.cents).toBe(500); // 300 + 200 merged
    expect(f.expenditures[0].id).toBe("e3"); // newest paidAt first
  });
});

describe("getOverview", () => {
  it("computes cash-on-hand and status tallies across partitions", async () => {
    pageMock({
      DONOR: [{ Items: [{ contributions: [{ amountCents: 1000 }] }] }],
      EXPENDITURE: [{ Items: [{ amountCents: 400 }] }],
      VOLUNTEER: [{ Items: [{ status: "ACTIVE" }, { status: "NEW" }, { status: "ACTIVE" }] }],
      TASK: [{ Items: [{ status: "TODO" }, { status: "DOING" }, { status: "DONE" }, { status: "TODO" }] }],
      MILESTONE: [{ Items: [{ SK: "m1", phase: "p", title: "t1", target: "x", done: true, sortOrder: 2 }, { SK: "m2", phase: "p", title: "t2", target: "y", sortOrder: 1 }] }],
    });
    const o = await getOverview();
    expect(o.connected).toBe(true);
    if (!o.connected) return;
    expect(o.raisedCents).toBe(1000);
    expect(o.spentCents).toBe(400);
    expect(o.cashOnHandCents).toBe(600);
    expect(o.donorCount).toBe(1);
    expect(o.volunteerTotal).toBe(3);
    expect(o.volActive).toBe(2);
    expect(o.tasksTodo).toBe(2);
    expect(o.tasksDoing).toBe(1);
    expect(o.tasksDone).toBe(1);
    expect(o.milestones.map((m) => m.id)).toEqual(["m2", "m1"]); // sorted by sortOrder
  });
});
