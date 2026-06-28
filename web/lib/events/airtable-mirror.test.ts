import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EventRow } from "@/lib/events/types";

// Test the dashboard→Airtable mirror in isolation: the field mapping and the strictly best-effort
// contract (never throw, no-op when unconfigured). Mock the secret + the raw fetch the writes use.
const getSecret = vi.fn<(n: string) => Promise<string | undefined>>();
vi.mock("@/lib/ssm", () => ({ getSecret: (n: string) => getSecret(n) }));

import { mirrorEventToAirtable, mirrorEventStatusToAirtable, deleteEventFromAirtable } from "./airtable";

// Capture the Airtable REST calls. Each returns 200 with a fresh record id by default.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", (...a: unknown[]) => fetchMock(...a));
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
// Parse a request into { method, recId?, fields? } for assertions.
function callAt(i: number) {
  const [url, init] = fetchMock.mock.calls[i] as [string, { method: string; body?: string }];
  const recId = url.match(/\/(rec[^/?]+)(?:$|\?)/)?.[1];
  const fields = init.body ? (JSON.parse(init.body).fields as Record<string, unknown>) : undefined;
  return { method: init.method, recId, fields };
}

function makeEvent(over: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt_1", title: "Town Hall in St. Charles", type: "town-hall",
    start: "2026-07-15T18:30:00", end: null, allDay: false,
    location: { name: "Foundry Art Centre", address: "", city: "St. Charles", county: "St. Charles" },
    lat: null, lng: null, districtKey: "district:mo-02", description: "Come meet Matt.",
    status: "PUBLISHED", capacity: 120, priority: 2, priorityManual: false,
    checklist: [], signups: [], captain: { id: "stf_1", name: "Jane Captain" }, volunteers: [],
    source: "manual", parseConfidence: null, notifiedEmailAt: null, notifiedSmsAt: null, notifyResult: null,
    createdBy: "staff", createdAt: "", updatedAt: null,
    ...over,
  };
}

beforeEach(() => {
  getSecret.mockReset();
  fetchMock.mockReset();
  getSecret.mockResolvedValue("key"); // configured by default
  fetchMock.mockResolvedValue(okJson({ id: "recNEW" }));
});

describe("event → Airtable mirror", () => {
  it("no-ops (returns null) when Airtable is not configured", async () => {
    getSecret.mockResolvedValue(undefined);
    expect(await mirrorEventToAirtable(makeEvent())).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a record (POST) and maps the content fields", async () => {
    const recId = await mirrorEventToAirtable(makeEvent());
    expect(recId).toBe("recNEW");
    const c = callAt(0);
    expect(c.method).toBe("POST");
    expect(c.recId).toBeUndefined();
    expect(c.fields).toMatchObject({
      "Event Name": "Town Hall in St. Charles",
      "Event Type": "Town hall", // town-hall → Airtable choice
      Date: "2026-07-15",
      Time: "6:30 PM", // parsed from the ISO time, tz-safe
      Venue: "Foundry Art Centre",
      Capacity: 120,
      Status: "Confirmed", // PUBLISHED → public-ready Airtable status
      "Host / Lead": "Jane Captain",
      Notes: "Come meet Matt.",
    });
  });

  it("updates in place (PATCH) when given a record id", async () => {
    const recId = await mirrorEventToAirtable(makeEvent({ status: "DRAFT" }), "recEXISTING");
    expect(recId).toBe("recEXISTING");
    const c = callAt(0);
    expect(c.method).toBe("PATCH");
    expect(c.recId).toBe("recEXISTING");
    expect(c.fields?.Status).toBe("Planning"); // DRAFT → Planning
  });

  it("omits Event Type with no clean Airtable equivalent, and Time when all-day", async () => {
    await mirrorEventToAirtable(makeEvent({ type: "rally", allDay: true, start: "2026-08-01T00:00:00" }));
    const c = callAt(0);
    expect(c.fields?.["Event Type"]).toBeUndefined();
    expect(c.fields?.Time).toBeUndefined();
  });

  it("is best-effort: a fetch error returns null instead of throwing", async () => {
    fetchMock.mockRejectedValue(new Error("Airtable 500"));
    await expect(mirrorEventToAirtable(makeEvent())).resolves.toBeNull();
  });

  it("is best-effort: a non-2xx response returns null", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({}) });
    await expect(mirrorEventToAirtable(makeEvent())).resolves.toBeNull();
  });

  it("mirrors a status change (PATCH), and no-ops without a record id", async () => {
    await mirrorEventStatusToAirtable("recX", "CANCELLED");
    const c = callAt(0);
    expect(c.method).toBe("PATCH");
    expect(c.recId).toBe("recX");
    expect(c.fields).toEqual({ Status: "Cancelled" });
    fetchMock.mockClear();
    await mirrorEventStatusToAirtable(null, "PUBLISHED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the mirror row (DELETE, best-effort, no-op without id)", async () => {
    await deleteEventFromAirtable("recX");
    expect(callAt(0).method).toBe("DELETE");
    expect(callAt(0).recId).toBe("recX");
    fetchMock.mockClear();
    await deleteEventFromAirtable(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
