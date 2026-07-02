import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const createEvent = vi.fn();
const listEvents = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/events", () => ({
  createEvent: (...a: unknown[]) => createEvent(...a),
  listEvents: (...a: unknown[]) => listEvents(...a),
}));
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { GET, POST } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const post = (body: unknown) =>
  new Request("http://test/api/ext/events", {
    method: "POST",
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const valid = { title: "Rally", type: "rally", start: "2026-08-01T18:00:00.000Z", description: "Come out" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("POST /api/ext/events", () => {
  it("403 without manageEvents", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await POST(post(valid));
    expect(res.status).toBe(403);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("400 on an invalid type", async () => {
    const res = await POST(post({ ...valid, type: "carnival" }));
    expect(res.status).toBe(400);
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("creates with session createdBy + default location, and audits", async () => {
    createEvent.mockResolvedValue("evt_1");
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rally", type: "rally", createdBy: "a@x.com", location: { name: "", address: "", city: "", county: "" } }),
    );
    expect(recordExtAction).toHaveBeenCalledWith(expect.objectContaining({ action: "event.create", target: "evt_1" }));
  });
});

describe("GET /api/ext/events", () => {
  it("lists events when allowed", async () => {
    listEvents.mockResolvedValue({ connected: true, rows: [{ id: "evt_1" }] });
    const res = await GET(new Request("http://test/api/ext/events", { headers: { origin: EXT } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rows: unknown[] } };
    expect(body.data.rows).toHaveLength(1);
  });
});
