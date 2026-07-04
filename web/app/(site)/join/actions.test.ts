import { describe, it, expect, vi, beforeEach } from "vitest";

// The /join server actions: honeypot + rate-limit guards, correct door + field
// mapping into saveVolunteerSignup, and the session-email-over-form rule for the
// account-backed volunteer/captain flow. The intake + infra are mocked.
const saveVolunteerSignup = vi.fn();
vi.mock("@/lib/volunteers/intake", () => ({ saveVolunteerSignup: (a: unknown) => saveVolunteerSignup(a) }));
const rateLimit = vi.fn();
vi.mock("@/lib/ratelimit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a), clientIpFromHeaders: () => "203.0.113.1" }));
const staffGate = vi.fn();
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("next/headers", () => ({ headers: async () => new Map<string, string>() }));

import { submitUpdates, submitPledge, submitVolunteerDetail } from "./actions";

const fd = (entries: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) (Array.isArray(v) ? v : [v]).forEach((x) => f.append(k, x));
  return f;
};

beforeEach(() => {
  saveVolunteerSignup.mockReset().mockResolvedValue({ ok: true, message: "saved" });
  rateLimit.mockReset().mockResolvedValue({ allowed: true });
  staffGate.mockReset().mockResolvedValue({ email: null });
});

describe("submitUpdates", () => {
  it("honeypot: a filled company field returns success WITHOUT saving", async () => {
    const r = await submitUpdates(null, fd({ name: "Bot", company: "ACME" }));
    expect(r.ok).toBe(true);
    expect(saveVolunteerSignup).not.toHaveBeenCalled();
  });

  it("rate-limited → does not save", async () => {
    rateLimit.mockResolvedValue({ allowed: false });
    const r = await submitUpdates(null, fd({ name: "Dana", email: "d@x.com" }));
    expect(r.ok).toBe(false);
    expect(saveVolunteerSignup).not.toHaveBeenCalled();
  });

  it("maps fields and uses the Get Updates door", async () => {
    await submitUpdates(null, fd({ name: "Dana", email: "d@x.com", phone: "314", zip: "63101", smsOptIn: "1" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dana", email: "d@x.com", zip: "63101", smsOptIn: true, door: "Get Updates" }),
    );
  });
});

describe("submitPledge", () => {
  it("parses a dollar amount and uses the Donor Pledge door", async () => {
    await submitPledge(null, fd({ name: "Pat", email: "p@x.com", pledgeAmount: "$50.50" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(
      expect.objectContaining({ door: "Donor Pledge", pledgeAmount: 50.5 }),
    );
  });

  it("null amount when unparseable", async () => {
    await submitPledge(null, fd({ name: "Pat", email: "p@x.com", pledgeAmount: "lots" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(expect.objectContaining({ pledgeAmount: null }));
  });
});

describe("submitVolunteerDetail", () => {
  it("prefers the SESSION email over the form email", async () => {
    staffGate.mockResolvedValue({ email: "session@x.com" });
    await submitVolunteerDetail(null, fd({ door: "Volunteer", name: "V", email: "typed@x.com" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(expect.objectContaining({ email: "session@x.com" }));
  });

  it("falls back to the form email when there is no session (demo/keyless)", async () => {
    await submitVolunteerDetail(null, fd({ door: "Volunteer", name: "V", email: "typed@x.com" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(expect.objectContaining({ email: "typed@x.com" }));
  });

  it("no email anywhere → error, no save", async () => {
    const r = await submitVolunteerDetail(null, fd({ door: "Volunteer", name: "V" }));
    expect(r.ok).toBe(false);
    expect(saveVolunteerSignup).not.toHaveBeenCalled();
  });

  it("Team Captain forces commitment Core and carries the captain note", async () => {
    staffGate.mockResolvedValue({ email: "lead@x.com" });
    await submitVolunteerDetail(null, fd({ door: "Team Captain", name: "Lee", captainNote: "I lead the PTA" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(
      expect.objectContaining({ door: "Team Captain", commitmentLevel: "Core", captainNote: "I lead the PTA" }),
    );
  });

  it("rejects an unknown door, defaulting to Volunteer", async () => {
    staffGate.mockResolvedValue({ email: "x@x.com" });
    await submitVolunteerDetail(null, fd({ door: "Admin", name: "X" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(expect.objectContaining({ door: "Volunteer" }));
  });

  it("passes the SMS opt-in through", async () => {
    staffGate.mockResolvedValue({ email: "v@x.com" });
    await submitVolunteerDetail(null, fd({ door: "Volunteer", name: "V", smsOptIn: "1" }));
    expect(saveVolunteerSignup).toHaveBeenCalledWith(expect.objectContaining({ smsOptIn: true }));
  });
});
