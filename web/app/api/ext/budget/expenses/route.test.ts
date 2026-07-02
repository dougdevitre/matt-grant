import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const accessAllows = vi.fn();
const proposeExpense = vi.fn();
const listExpenses = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/airtable/access", () => ({ can: (...a: unknown[]) => accessAllows(...a) }));
vi.mock("@/lib/budget/expenses", () => ({
  proposeExpense: (...a: unknown[]) => proposeExpense(...a),
  listExpenses: (...a: unknown[]) => listExpenses(...a),
}));
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { GET, POST } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const post = (body: unknown) =>
  new Request("http://test/api/ext/budget/expenses", {
    method: "POST",
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
  accessAllows.mockResolvedValue(true);
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("POST /api/ext/budget/expenses", () => {
  it("403 without viewFinanceTotals", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await POST(post({ vendor: "ACME" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    expect(proposeExpense).not.toHaveBeenCalled();
  });

  it("403 when the Airtable create toggle is off", async () => {
    accessAllows.mockResolvedValue(false);
    const res = await POST(post({ vendor: "ACME" }));
    expect(res.status).toBe(403);
    expect(proposeExpense).not.toHaveBeenCalled();
  });

  it("400 when neither title nor vendor is provided", async () => {
    const res = await POST(post({ purpose: "stuff" }));
    expect(res.status).toBe(400);
    expect(proposeExpense).not.toHaveBeenCalled();
  });

  it("creates the request with session identity and audits it", async () => {
    proposeExpense.mockResolvedValue({ id: "exp_1" });
    const res = await POST(post({ vendor: "ACME", quantity: 2, unitPrice: 50 }));
    expect(res.status).toBe(200);
    expect(proposeExpense).toHaveBeenCalledWith(
      expect.objectContaining({ vendor: "ACME", submittedBy: "a@x.com", submitterEmail: "a@x.com", neededBy: null }),
    );
    expect(recordExtAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "expense.create", target: "exp_1", actor: "a@x.com" }),
    );
  });
});

describe("GET /api/ext/budget/expenses", () => {
  it("lists expenses when allowed", async () => {
    listExpenses.mockResolvedValue([{ id: "exp_1" }]);
    const res = await GET(new Request("http://test/api/ext/budget/expenses", { headers: { origin: EXT } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});
