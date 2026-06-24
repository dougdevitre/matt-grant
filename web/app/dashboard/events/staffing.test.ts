import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the event store + auth; keep @/lib/rbac REAL so the manageEvents gate is
// genuinely exercised. Other modules imported by actions.ts are stubbed so the
// import stays hermetic (no AI/SES/geocoder pulled in).
const staffGate = vi.fn();
const updateEvent = vi.fn();
const getEvent = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/events", () => ({
  createEvent: vi.fn(),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  setEventStatus: vi.fn(),
  deleteEvent: vi.fn(),
  getEvent: (...a: unknown[]) => getEvent(...a),
  setEventNotify: vi.fn(),
  isEventType: () => true,
}));
vi.mock("@/lib/events/time", () => ({ localCentralToIso: (s: string) => s }));
vi.mock("@/lib/events/geocode", () => ({ geocodeAddress: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/events/notify", () => ({ publishEventNotifications: vi.fn() }));
vi.mock("@/lib/events/parseEmail", () => ({ parseForwardedEmail: vi.fn() }));
vi.mock("@/lib/events/insights", () => ({ refreshDistrictInsight: vi.fn() }));
vi.mock("@/lib/db", () => ({ newId: () => "new-item-id" }));

import {
  setEventCaptain, addEventVolunteer, removeEventVolunteer,
  setEventPriority, toggleChecklistItem, addChecklistItem, removeChecklistItem, assignChecklistItem,
} from "./actions";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const patchOf = () => (updateEvent.mock.calls[0] as unknown[])[1] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  staffGate.mockResolvedValue({ ok: true, role: "admin", email: "a@x.test" });
});

describe("setEventCaptain", () => {
  it("assigns the decoded captain", async () => {
    await setEventCaptain(fd({ id: "e1", captain: "cap@x.test|Casey Captain" }));
    expect(updateEvent).toHaveBeenCalledWith("e1", { captain: { id: "cap@x.test", name: "Casey Captain" } });
  });

  it("clears the captain on a blank value", async () => {
    await setEventCaptain(fd({ id: "e1", captain: "" }));
    expect(patchOf()).toEqual({ captain: null });
  });
});

describe("addEventVolunteer", () => {
  it("appends a volunteer to the roster", async () => {
    getEvent.mockResolvedValue({ volunteers: [{ id: "v1", name: "Ann" }] });
    await addEventVolunteer(fd({ id: "e1", volunteer: "v2|Ben" }));
    expect(patchOf()).toEqual({ volunteers: [{ id: "v1", name: "Ann" }, { id: "v2", name: "Ben" }] });
  });

  it("is idempotent — adding someone already on the roster is a no-op", async () => {
    getEvent.mockResolvedValue({ volunteers: [{ id: "v1", name: "Ann" }] });
    await addEventVolunteer(fd({ id: "e1", volunteer: "v1|Ann" }));
    expect(updateEvent).not.toHaveBeenCalled();
  });
});

describe("removeEventVolunteer", () => {
  it("drops the volunteer by id", async () => {
    getEvent.mockResolvedValue({ volunteers: [{ id: "v1", name: "Ann" }, { id: "v2", name: "Ben" }] });
    await removeEventVolunteer(fd({ id: "e1", volunteerId: "v1" }));
    expect(patchOf()).toEqual({ volunteers: [{ id: "v2", name: "Ben" }] });
  });
});

describe("setEventPriority", () => {
  it("sets the tier and marks it manual", async () => {
    await setEventPriority(fd({ id: "e1", priority: "1" }));
    expect(updateEvent).toHaveBeenCalledWith("e1", { priority: 1, priorityManual: true });
  });

  it("ignores an out-of-range value", async () => {
    await setEventPriority(fd({ id: "e1", priority: "9" }));
    expect(updateEvent).not.toHaveBeenCalled();
  });
});

describe("checklist actions", () => {
  it("toggleChecklistItem checks an item and stamps who/when", async () => {
    getEvent.mockResolvedValue({ checklist: [{ id: "i1", text: "Banner", done: false }] });
    await toggleChecklistItem(fd({ id: "e1", itemId: "i1" }));
    const item = (patchOf().checklist as Array<Record<string, unknown>>)[0];
    expect(item.done).toBe(true);
    expect(item.doneBy).toBe("a@x.test");
    expect(typeof item.doneAt).toBe("string");
  });

  it("toggleChecklistItem unchecks and clears the stamp", async () => {
    getEvent.mockResolvedValue({ checklist: [{ id: "i1", text: "Banner", done: true, doneBy: "x", doneAt: "t" }] });
    await toggleChecklistItem(fd({ id: "e1", itemId: "i1" }));
    const item = (patchOf().checklist as Array<Record<string, unknown>>)[0];
    expect(item.done).toBe(false);
    expect(item.doneBy).toBeUndefined();
  });

  it("addChecklistItem appends a new item with a generated id", async () => {
    getEvent.mockResolvedValue({ checklist: [] });
    await addChecklistItem(fd({ id: "e1", text: "Bring water" }));
    expect(patchOf().checklist).toEqual([{ id: "new-item-id", text: "Bring water", done: false }]);
  });

  it("removeChecklistItem drops by id", async () => {
    getEvent.mockResolvedValue({ checklist: [{ id: "i1", text: "A", done: false }, { id: "i2", text: "B", done: false }] });
    await removeChecklistItem(fd({ id: "e1", itemId: "i1" }));
    expect((patchOf().checklist as Array<Record<string, unknown>>).map((i) => i.id)).toEqual(["i2"]);
  });

  it("assignChecklistItem sets the assignee from id|name", async () => {
    getEvent.mockResolvedValue({ checklist: [{ id: "i1", text: "A", done: false }] });
    await assignChecklistItem(fd({ id: "e1", itemId: "i1", assignee: "v2|Ben" }));
    const item = (patchOf().checklist as Array<Record<string, unknown>>)[0];
    expect(item.assigneeId).toBe("v2");
    expect(item.assigneeName).toBe("Ben");
  });
});

describe("RBAC gate", () => {
  it("refuses a role without manageEvents and never writes", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "member", email: "m@x.test" });
    await setEventCaptain(fd({ id: "e1", captain: "cap@x.test|Casey" }));
    await addEventVolunteer(fd({ id: "e1", volunteer: "v2|Ben" }));
    await setEventPriority(fd({ id: "e1", priority: "1" }));
    await toggleChecklistItem(fd({ id: "e1", itemId: "i1" }));
    expect(updateEvent).not.toHaveBeenCalled();
  });
});
