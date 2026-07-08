import { describe, it, expect, vi, beforeEach } from "vitest";

// RSVP records SMS consent as a side effect ONLY on an explicit opt-in checkbox +
// a normalizable phone. Mock the request context, the event store, the limiter,
// and the consent ledger; leave toE164 (pure) real.
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { getEvent, addSignup, isEventFull } = vi.hoisted(() => ({
  getEvent: vi.fn(),
  addSignup: vi.fn(),
  isEventFull: vi.fn(),
}));
const { recordConsent } = vi.hoisted(() => ({ recordConsent: vi.fn() }));

vi.mock("next/headers", () => ({ headers: async () => ({ get: () => "203.0.113.7" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit, clientIpFromHeaders: () => "203.0.113.7" }));
vi.mock("@/lib/events", () => ({ getEvent, addSignup, isEventFull }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(), sesEnabled: false }));
vi.mock("@/lib/sms/consent", () => ({ recordConsent }));

import { rsvp } from "./actions";

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set("eventId", "evt1");
  fd.set("name", "Pat Voter");
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  recordConsent.mockResolvedValue(true);
  rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 12, resetAt: 0 });
  getEvent.mockResolvedValue({ id: "evt1", status: "PUBLISHED", capacity: null, signups: [] });
  isEventFull.mockReturnValue(false);
  addSignup.mockResolvedValue(true);
});

describe("rsvp → SMS consent", () => {
  it("records consent when opted in with a valid phone", async () => {
    const res = await rsvp(form({ phone: "314-555-0100", smsOptIn: "1" }));
    expect(res.ok).toBe(true);
    expect(recordConsent).toHaveBeenCalledWith("+13145550100", "event-rsvp");
  });

  it("does NOT record consent without the opt-in checkbox", async () => {
    await rsvp(form({ phone: "314-555-0100" }));
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("does NOT record consent when opted in but no phone given", async () => {
    await rsvp(form({ smsOptIn: "1" }));
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("does NOT record consent when the phone can't be normalized", async () => {
    await rsvp(form({ phone: "555-0100", smsOptIn: "1" }));
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("does NOT record consent when the signup itself failed", async () => {
    addSignup.mockResolvedValue(false);
    await rsvp(form({ phone: "314-555-0100", smsOptIn: "1" }));
    expect(recordConsent).not.toHaveBeenCalled();
  });
});
