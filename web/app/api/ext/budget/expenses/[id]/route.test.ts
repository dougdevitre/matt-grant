import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const accessAllows = vi.fn();
const transitionExpense = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/airtable/access", () => ({ can: (...a: unknown[]) => accessAllows(...a) }));
vi.mock("@/lib/budget/expenses", () => {
  class IllegalTransitionError extends Error {}
  class ExpenseNotFoundError extends Error {}
  return {
    transitionExpense: (...a: unknown[]) => transitionExpense(...a),
    IllegalTransitionError,
    ExpenseNotFoundError,
  };
});
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { PATCH } from "./route";
import { IllegalTransitionError, ExpenseNotFoundError } from "@/lib/budget/expenses";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const patch = (body: unknown) =>
  new Request("http://test/api/ext/budget/expenses/exp_1", {
    method: "PATCH",
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const params = Promise.resolve({ id: "exp_1" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
  accessAllows.mockResolvedValue(true);
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("PATCH /api/ext/budget/expenses/[id]", () => {
  it("403 without editFinance", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await PATCH(patch({ status: "Approved" }), { params });
    expect(res.status).toBe(403);
    expect(transitionExpense).not.toHaveBeenCalled();
  });

  it("400 on an unknown status", async () => {
    const res = await PATCH(patch({ status: "Nope" }), { params });
    expect(res.status).toBe(400);
    expect(transitionExpense).not.toHaveBeenCalled();
  });

  it("transitions and audits on success", async () => {
    transitionExpense.mockResolvedValue({ id: "exp_1", status: "Approved" });
    const res = await PATCH(patch({ status: "Approved" }), { params });
    expect(res.status).toBe(200);
    expect(transitionExpense).toHaveBeenCalledWith("exp_1", expect.objectContaining({ status: "Approved" }));
    expect(recordExtAction).toHaveBeenCalledWith(expect.objectContaining({ action: "expense.transition", target: "exp_1" }));
  });

  it("maps ExpenseNotFoundError → 404", async () => {
    transitionExpense.mockRejectedValue(new ExpenseNotFoundError());
    const res = await PATCH(patch({ status: "Approved" }), { params });
    expect(res.status).toBe(404);
  });

  it("maps IllegalTransitionError → 409", async () => {
    transitionExpense.mockRejectedValue(new IllegalTransitionError("Proposed", "Paid"));
    const res = await PATCH(patch({ status: "Paid" }), { params });
    expect(res.status).toBe(409);
  });
});
