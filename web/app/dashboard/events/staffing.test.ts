import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the event store + auth; keep @/lib/rbac REAL so the manageEvents gate is
// genuinely exercised. Other modules imported by actions.ts are stubbed so the
// import stays hermetic (no AI/SES/geocoder pulled in).
const staffGate = vi.fn();
const updateEvent = vi.fn();
const mutateEvent = vi.fn();
const getEvent = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/events", () => ({
  createEvent: vi.fn(),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  mutateEvent: (...a: unknown[]) => mutateEvent(...a),
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
// The array/checklist actions now go through mutateEvent(id, apply); run the captured
// apply against a fixture event to assert the patch it would persist (null = no-op).
type EvFixture = { volunteers?: unknown[]; checklist?: unknown[] };
const applyOf = () => (mutateEvent.mock.calls[0] as unknown[])[1] as (ev: EvFixture) => Record<string, unknown> | null;
const runApply = (ev: EvFixture) => applyOf()(ev);

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
  it("appends a volunteer to the roster (applied to the fresh event under CAS)", async () => {
    await addEventVolunteer(fd({ id: "e1", volunteer: "v2|Ben" }));
    expect(mutateEvent.mock.calls[0][0]).toBe("e1");
    expect(runApply({ volunteers: [{ id: "v1", name: "Ann" }] })).toEqual({
      volunteers: [{ id: "v1", name: "Ann" }, { id: "v2", name: "Ben" }],
    });
  });

  it("is idempotent — apply returns null when already on the roster", async () => {
    await addEventVolunteer(fd({ id: "e1", volunteer: "v1|Ann" }));
    expect(runApply({ volunteers: [{ id: "v1", name: "Ann" }] })).toBeNull();
  });
});

describe("removeEventVolunteer", () => {
  it("drops the volunteer by id", async () => {
    await removeEventVolunteer(fd({ id: "e1", volunteerId: "v1" }));
    expect(runApply({ volunteers: [{ id: "v1", name: "Ann" }, { id: "v2", name: "Ben" }] })).toEqual({
      volunteers: [{ id: "v2", name: "Ben" }],
    });
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
  const checklistOf = (patch: Record<string, unknown> | null) =>
    (patch!.checklist as Array<Record<string, unknown>>);

  it("toggleChecklistItem checks an item and stamps who/when", async () => {
    await toggleChecklistItem(fd({ id: "e1", itemId: "i1" }));
    const item = checklistOf(runApply({ checklist: [{ id: "i1", text: "Banner", done: false }] }))[0];
    expect(item.done).toBe(true);
    expect(item.doneBy).toBe("a@x.test");
    expect(typeof item.doneAt).toBe("string");
  });

  it("toggleChecklistItem unchecks and clears the stamp", async () => {
    await toggleChecklistItem(fd({ id: "e1", itemId: "i1" }));
    const item = checklistOf(runApply({ checklist: [{ id: "i1", text: "Banner", done: true, doneBy: "x", doneAt: "t" }] }))[0];
    expect(item.done).toBe(false);
    expect(item.doneBy).toBeUndefined();
  });

  it("addChecklistItem appends a new item with a generated id", async () => {
    await addChecklistItem(fd({ id: "e1", text: "Bring water" }));
    expect(checklistOf(runApply({ checklist: [] }))).toEqual([{ id: "new-item-id", text: "Bring water", done: false }]);
  });

  it("removeChecklistItem drops by id", async () => {
    await removeChecklistItem(fd({ id: "e1", itemId: "i1" }));
    const list = checklistOf(runApply({ checklist: [{ id: "i1", text: "A", done: false }, { id: "i2", text: "B", done: false }] }));
    expect(list.map((i) => i.id)).toEqual(["i2"]);
  });

  it("assignChecklistItem sets the assignee from id|name", async () => {
    await assignChecklistItem(fd({ id: "e1", itemId: "i1", assignee: "v2|Ben" }));
    const item = checklistOf(runApply({ checklist: [{ id: "i1", text: "A", done: false }] }))[0];
    expect(item.assigneeId).toBe("v2");
    expect(item.assigneeName).toBe("Ben");
  });
});

describe("RBAC gate", () => {
  it("refuses a role without manageEvents and never writes", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "volunteer", email: "m@x.test" });
    await setEventCaptain(fd({ id: "e1", captain: "cap@x.test|Casey" }));
    await addEventVolunteer(fd({ id: "e1", volunteer: "v2|Ben" }));
    await setEventPriority(fd({ id: "e1", priority: "1" }));
    await toggleChecklistItem(fd({ id: "e1", itemId: "i1" }));
    expect(updateEvent).not.toHaveBeenCalled();
    expect(mutateEvent).not.toHaveBeenCalled();
  });
});
