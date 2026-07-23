import { describe, it, expect, vi, beforeEach } from "vitest";

// Keep @/lib/rbac REAL so the sendSms capability gate is genuinely exercised. toE164
// is a faithful stand-in; sendSms/isOptedIn/smsEnabled are mocked so no Twilio/DB.
const staffGate = vi.fn();
const smsEnabled = vi.fn();
const sendSms = vi.fn();
const isOptedIn = vi.fn();
const runSmsEnrichment = vi.fn();

vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/sms/send", () => ({
  smsEnabled: () => smsEnabled(),
  sendSms: (...a: unknown[]) => sendSms(...a),
  toE164: (s: string) => {
    const d = String(s).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d[0] === "1") return `+${d}`;
    return null;
  },
}));
vi.mock("@/lib/sms/consent", () => ({ isOptedIn: (...a: unknown[]) => isOptedIn(...a) }));
vi.mock("@/lib/reports/smsEnrichmentRun", () => ({ runSmsEnrichment: (...a: unknown[]) => runSmsEnrichment(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { sendGoLiveTest, runEnrichmentNow } from "./actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  staffGate.mockResolvedValue({ ok: true, role: "admin", email: "a@x.test" });
  smsEnabled.mockResolvedValue(true);
  isOptedIn.mockResolvedValue(true);
  sendSms.mockResolvedValue({ sent: true, sid: "SM1" });
  runSmsEnrichment.mockResolvedValue({
    optedIn: 8,
    voterMatchedTags: 3,
    contactZipOnlyTags: 1,
    geoPreserved: 0,
    skippedNotOptedIn: 0,
    totalWrites: 4,
    written: 4,
    byCounty: {},
    dryRun: false,
  });
});

describe("sendGoLiveTest", () => {
  it("sends to an opted-in number and reports success", async () => {
    const res = await sendGoLiveTest(form({ to: "(314) 555-1234", body: "hi" }));
    expect(res.ok).toBe(true);
    expect(sendSms).toHaveBeenCalledWith({ to: "+13145551234", body: "hi" });
  });

  it("defaults the body when none is given", async () => {
    await sendGoLiveTest(form({ to: "+13145551234" }));
    expect(sendSms).toHaveBeenCalledWith({ to: "+13145551234", body: expect.stringMatching(/Reply STOP/) });
  });

  it("refuses a non-admin (lacks sendSms) and never sends", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "captain", email: "c@x.test" });
    const res = await sendGoLiveTest(form({ to: "+13145551234" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/admins/i);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("blocks when Twilio isn't configured", async () => {
    smsEnabled.mockResolvedValue(false);
    const res = await sendGoLiveTest(form({ to: "+13145551234" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/isn't configured/i);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("rejects an invalid number", async () => {
    const res = await sendGoLiveTest(form({ to: "nonsense" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/valid US mobile/i);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("refuses a number that isn't opted in (TCPA)", async () => {
    isOptedIn.mockResolvedValue(false);
    const res = await sendGoLiveTest(form({ to: "+13145551234" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/opted in/i);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("surfaces a Twilio send failure", async () => {
    sendSms.mockResolvedValue({ sent: false, error: "Twilio 30032" });
    const res = await sendGoLiveTest(form({ to: "+13145551234" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/30032/);
  });
});

describe("runEnrichmentNow", () => {
  it("runs enrichment for an admin and reports the counts", async () => {
    const res = await runEnrichmentNow();
    expect(res.ok).toBe(true);
    expect(runSmsEnrichment).toHaveBeenCalledTimes(1);
    expect(res.message).toMatch(/4\/4/);
    expect(res.message).toMatch(/3 matched/);
  });

  it("refuses a non-admin (lacks manageTeam) and never enriches", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "captain", email: "c@x.test" });
    const res = await runEnrichmentNow();
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/admins/i);
    expect(runSmsEnrichment).not.toHaveBeenCalled();
  });

  it("surfaces an enrichment failure without throwing", async () => {
    runSmsEnrichment.mockRejectedValue(new Error("DYNAMODB_TABLE not set"));
    const res = await runEnrichmentNow();
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Couldn't enrich/i);
    expect(res.message).toMatch(/DYNAMODB_TABLE/);
  });
});
