import { describe, it, expect, vi, beforeEach } from "vitest";

// The CSV import writes SMS consent ONLY when the importer attests AND the row's own
// "sms consent" column is affirmative AND the phone normalizes. Mock DynamoDB, the
// staff gate, and the consent ledger; leave the pure CSV parser + toE164 real.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
const { recordConsent } = vi.hoisted(() => ({ recordConsent: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ ddb: { send }, TABLE: "t", PK: { volunteers: "VOL" }, newId: () => "rid", dbConfigured: true }));
vi.mock("@/lib/auth", () => ({ staffGate: async () => ({ role: "admin", email: "staff@x.com" }) }));
vi.mock("@/lib/rbac", () => ({ can: () => true }));
vi.mock("@/lib/sms/consent", () => ({ recordConsent }));

import { importVolunteers } from "./actions";

const form = (csv: string, attest = false) => {
  const fd = new FormData();
  fd.set("csv", csv);
  if (attest) fd.set("smsAttest", "1");
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({});
  recordConsent.mockResolvedValue(true);
});

const CSV_CONSENTED = "name,phone,sms consent\nJane Doe,314-555-0100,yes";

describe("importVolunteers → SMS consent", () => {
  it("records consent for an attested + consented row with a valid phone", async () => {
    const res = await importVolunteers(null, form(CSV_CONSENTED, true));
    expect(res.ok).toBe(true);
    expect(recordConsent).toHaveBeenCalledWith("+13145550100", "csv-import");
    expect(res.message).toMatch(/added 1 to the SMS list/);
  });

  it("does NOT record consent without the staff attestation", async () => {
    const res = await importVolunteers(null, form(CSV_CONSENTED, false));
    expect(res.ok).toBe(true);
    expect(recordConsent).not.toHaveBeenCalled();
    expect(res.message).not.toMatch(/SMS list/);
  });

  it("does NOT record consent for a row whose consent column isn't affirmative", async () => {
    await importVolunteers(null, form("name,phone,sms consent\nJane Doe,314-555-0100,no", true));
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("does NOT record consent when the phone can't be normalized", async () => {
    await importVolunteers(null, form("name,phone,sms consent\nJane Doe,555-0100,yes", true));
    expect(recordConsent).not.toHaveBeenCalled();
  });
});
