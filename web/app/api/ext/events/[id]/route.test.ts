import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const updateEvent = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/events", () => ({ updateEvent: (...a: unknown[]) => updateEvent(...a) }));
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { PATCH } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const patch = (body: unknown) =>
  new Request("http://test/api/ext/events/evt_1", {
    method: "PATCH",
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const params = Promise.resolve({ id: "evt_1" });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("PATCH /api/ext/events/[id]", () => {
  it("403 without manageEvents", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await PATCH(patch({ status: "CANCELLED" }), { params });
    expect(res.status).toBe(403);
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("400 when the body has no fields", async () => {
    const res = await PATCH(patch({}), { params });
    expect(res.status).toBe(400);
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("404 when the event is not found", async () => {
    updateEvent.mockResolvedValue(false);
    const res = await PATCH(patch({ status: "PUBLISHED" }), { params });
    expect(res.status).toBe(404);
  });

  it("updates status (no notify) and audits", async () => {
    updateEvent.mockResolvedValue(true);
    const res = await PATCH(patch({ status: "PUBLISHED" }), { params });
    expect(res.status).toBe(200);
    expect(updateEvent).toHaveBeenCalledWith("evt_1", expect.objectContaining({ status: "PUBLISHED" }));
    expect(recordExtAction).toHaveBeenCalledWith(expect.objectContaining({ action: "event.update", target: "evt_1" }));
  });
});
