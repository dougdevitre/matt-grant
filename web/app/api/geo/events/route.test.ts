import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth + the event store so the GeoJSON handler runs hermetically (no AWS).
const checkCap = vi.fn();
const listEvents = vi.fn();
const listUpcomingEvents = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: () => checkCap() }));
vi.mock("@/lib/events", () => ({
  listEvents: () => listEvents(),
  listUpcomingEvents: (...a: unknown[]) => listUpcomingEvents(...a),
}));

import { GET } from "./route";

type Row = Record<string, unknown>;
const row = (over: Row = {}): Row => ({
  id: "e1", title: "Parade", type: "parade", status: "PUBLISHED",
  priority: 1, priorityManual: false, start: "2026-07-04T15:00:00.000Z", allDay: false,
  location: { name: "Main St", city: "Union", county: "Franklin", address: "" },
  lat: 38.45, lng: -91.0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/geo/events", () => {
  it("emits priority + priorityManual in each feature's properties", async () => {
    checkCap.mockResolvedValue({ allowed: true });
    listEvents.mockResolvedValue({ rows: [row({ priority: 1, priorityManual: true }), row({ id: "e2", priority: 3, priorityManual: false })] });

    const res = await GET();
    const body = (await res.json()) as { features: { properties: { priority: number; priorityManual: boolean } }[] };

    expect(body.features).toHaveLength(2);
    for (const f of body.features) {
      expect([1, 2, 3]).toContain(f.properties.priority);
      expect(typeof f.properties.priorityManual).toBe("boolean");
    }
    expect(body.features[0].properties).toMatchObject({ priority: 1, priorityManual: true });
    expect(body.features[1].properties).toMatchObject({ priority: 3, priorityManual: false });
  });

  it("non-managers get published upcoming events, still carrying priority", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    listUpcomingEvents.mockResolvedValue([row({ priority: 2 })]);

    const res = await GET();
    const body = (await res.json()) as { features: { properties: { priority: number } }[]; meta: { includesDrafts: boolean } };

    expect(listUpcomingEvents).toHaveBeenCalledWith({ publishedOnly: true });
    expect(body.meta.includesDrafts).toBe(false);
    expect(body.features[0].properties.priority).toBe(2);
  });

  it("skips events without coordinates", async () => {
    checkCap.mockResolvedValue({ allowed: true });
    listEvents.mockResolvedValue({ rows: [row({ lat: null, lng: null }), row({ id: "e2" })] });

    const res = await GET();
    const body = (await res.json()) as { features: unknown[] };
    expect(body.features).toHaveLength(1);
  });
});
