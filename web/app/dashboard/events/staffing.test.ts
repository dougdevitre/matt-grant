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

import { setEventCaptain, addEventVolunteer, removeEventVolunteer } from "./actions";

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

describe("RBAC gate", () => {
  it("refuses a role without manageEvents and never writes", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "member", email: "m@x.test" });
    await setEventCaptain(fd({ id: "e1", captain: "cap@x.test|Casey" }));
    await addEventVolunteer(fd({ id: "e1", volunteer: "v2|Ben" }));
    expect(updateEvent).not.toHaveBeenCalled();
  });
});
