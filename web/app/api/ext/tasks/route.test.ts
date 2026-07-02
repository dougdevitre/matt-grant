import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Guarded write surface: POST create + PATCH status, each capability-gated, zod-
// validated, CORS-wrapped, and audited. Auth/data/writers are mocked.
const checkCap = vi.fn();
const getTasks = vi.fn();
const createTask = vi.fn();
const setTaskStatus = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (cap: string) => checkCap(cap) }));
vi.mock("@/lib/queries", () => ({ getTasks: () => getTasks() }));
vi.mock("@/lib/tasks", () => ({
  createTask: (...a: unknown[]) => createTask(...a),
  setTaskStatus: (...a: unknown[]) => setTaskStatus(...a),
  TASK_STATUSES: ["TODO", "DOING", "DONE"],
}));
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { POST, PATCH, GET, OPTIONS } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const jsonReq = (method: string, body: unknown) =>
  new Request("http://test/api/ext/tasks", {
    method,
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("POST /api/ext/tasks (create)", () => {
  it("403 (with CORS) without manageTasks", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await POST(jsonReq("POST", { title: "x" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    expect(createTask).not.toHaveBeenCalled();
  });

  it("400 when title is missing/blank", async () => {
    const res = await POST(jsonReq("POST", { detail: "no title" }));
    expect(res.status).toBe(400);
    expect(createTask).not.toHaveBeenCalled();
  });

  it("creates the task, audits it, and returns the id in a Resource", async () => {
    createTask.mockResolvedValue("task_new");
    const res = await POST(jsonReq("POST", { title: "Knock doors", priority: "HIGH" }));
    expect(res.status).toBe(200);
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Knock doors", priority: "HIGH" }));
    expect(recordExtAction).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "a@x.com", action: "task.create", target: "task_new" }),
    );
    const body = (await res.json()) as { ok: boolean; data: { id: string } };
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("task_new");
  });
});

describe("PATCH /api/ext/tasks (status)", () => {
  it("400 on an unknown status", async () => {
    const res = await PATCH(jsonReq("PATCH", { id: "t1", status: "PARTY" }));
    expect(res.status).toBe(400);
    expect(setTaskStatus).not.toHaveBeenCalled();
  });

  it("moves the task and audits it", async () => {
    const res = await PATCH(jsonReq("PATCH", { id: "t1", status: "DONE" }));
    expect(res.status).toBe(200);
    expect(setTaskStatus).toHaveBeenCalledWith("t1", "DONE");
    expect(recordExtAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "task.status", target: "t1" }),
    );
  });

  it("403 without manageTasks", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await PATCH(jsonReq("PATCH", { id: "t1", status: "DONE" }));
    expect(res.status).toBe(403);
    expect(setTaskStatus).not.toHaveBeenCalled();
  });
});

describe("GET + OPTIONS still work", () => {
  it("GET lists tasks when allowed", async () => {
    getTasks.mockResolvedValue({ connected: true, rows: [{ id: "t1" }] });
    const res = await GET(new Request("http://test/api/ext/tasks", { headers: { origin: EXT } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { rows: unknown[] } };
    expect(body.data.rows).toHaveLength(1);
  });

  it("OPTIONS preflight is 204 with CORS", async () => {
    const res = await OPTIONS(new Request("http://test/api/ext/tasks", { headers: { origin: EXT } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    expect(res.headers.get("access-control-allow-methods")).toContain("PATCH");
  });
});
