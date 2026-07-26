import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DynamoDB layer and the phone normalizer so the TCPA gate logic is
// tested in isolation. toE164 is driven per-test: a null return models an
// unparseable number.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
const { toE164 } = vi.hoisted(() => ({ toE164: vi.fn() }));
vi.mock("@/lib/db", () => ({
  ddb: { send },
  TABLE: "test-table",
  dbConfigured: true,
  // listConsent() paginates via queryAllPages; delegate to the same send stub so
  // tests keep driving results with send.mockResolvedValue({ Items }).
  queryAllPages: async () => ((await send()) as { Items?: unknown[] }).Items ?? [],
}));
vi.mock("@/lib/sms/send", () => ({ toE164 }));

import { isOptedIn, consentStatus, recordConsent, recordOptOut, optedInSet, listConsent } from "./consent";

const E = "+15555550123";
beforeEach(() => {
  vi.clearAllMocks();
  toE164.mockReturnValue(E); // valid by default; override for the unknown-number cases
});

describe("isOptedIn — the texting gate", () => {
  it("is false for an unknown number (no consent row)", async () => {
    send.mockResolvedValue({}); // no Item
    expect(await isOptedIn("555-555-0123")).toBe(false);
  });

  it("is true only when an explicit opted_in row exists", async () => {
    send.mockResolvedValue({ Item: { status: "opted_in" } });
    expect(await isOptedIn("555-555-0123")).toBe(true);
  });

  it("is false once opted out", async () => {
    send.mockResolvedValue({ Item: { status: "opted_out" } });
    expect(await isOptedIn("555-555-0123")).toBe(false);
  });

  it("is false for an unparseable number without hitting the store", async () => {
    toE164.mockReturnValue(null);
    expect(await isOptedIn("not-a-phone")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("consentStatus", () => {
  it("maps opted_in / opted_out / unknown", async () => {
    send.mockResolvedValueOnce({ Item: { status: "opted_in" } });
    expect(await consentStatus("x")).toBe("opted_in");
    send.mockResolvedValueOnce({ Item: { status: "opted_out" } });
    expect(await consentStatus("x")).toBe("opted_out");
    send.mockResolvedValueOnce({}); // no row
    expect(await consentStatus("x")).toBe("unknown");
  });
});

describe("recordConsent / recordOptOut", () => {
  it("recordConsent writes an opted_in status and returns true", async () => {
    send.mockResolvedValue({});
    expect(await recordConsent("555-555-0123", "web-form")).toBe(true);
    const cmd = send.mock.calls[0][0];
    expect(cmd.input.Key).toEqual({ PK: "SMSCONSENT", SK: E });
    expect(cmd.input.ExpressionAttributeValues[":in"]).toBe("opted_in");
  });

  it("recordOptOut writes an opted_out status", async () => {
    send.mockResolvedValue({});
    expect(await recordOptOut("555-555-0123")).toBe(true);
    expect(send.mock.calls[0][0].input.ExpressionAttributeValues[":out"]).toBe("opted_out");
  });

  it("refuses (returns false, no write) when the number is unparseable", async () => {
    toE164.mockReturnValue(null);
    expect(await recordConsent("bad", "web-form")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("binds an explicit consentAt (for backfill) but keeps if_not_exists so a re-run can't clobber", async () => {
    send.mockResolvedValue({});
    const original = "2025-01-02T03:04:05.000Z";
    await recordConsent("555-555-0123", "games-lead-backfill", original);
    const cmd = send.mock.calls[0][0];
    // The passed timestamp is bound as :at, and the SET clause only writes it on first
    // consent (if_not_exists) — so backfilling never overwrites a live opt-in's date.
    expect(cmd.input.ExpressionAttributeValues[":at"]).toBe(original);
    expect(cmd.input.UpdateExpression).toContain("consentAt = if_not_exists(consentAt, :at)");
  });

  it("defaults consentAt to now when omitted (live opt-in)", async () => {
    send.mockResolvedValue({});
    await recordConsent("555-555-0123", "web-form");
    const v = send.mock.calls[0][0].input.ExpressionAttributeValues;
    expect(v[":at"]).toBe(v[":u"]); // same now-timestamp for consentAt + updatedAt
  });
});

describe("optedInSet", () => {
  it("collects only opted_in numbers from the ledger", async () => {
    send.mockResolvedValue({
      Items: [
        { SK: "+15555550001", status: "opted_in" },
        { SK: "+15555550002", status: "opted_out" },
        { SK: "+15555550003", status: "opted_in" },
      ],
    });
    const set = await optedInSet();
    expect([...set].sort()).toEqual(["+15555550001", "+15555550003"]);
    expect(set.has("+15555550002")).toBe(false);
  });
});

describe("listConsent — the projection the composer targets on", () => {
  // Every targeting dimension is read off THIS mapping. A field the composer
  // filters on but listConsent drops matches nobody against real data while every
  // mocked unit test still passes — so assert the raw item → row mapping directly.
  it("carries every targeting field through from the stored item", async () => {
    send.mockResolvedValue({
      Items: [
        {
          SK: "+15555550001",
          status: "opted_in",
          source: "sms-keyword",
          consentAt: "2026-07-01T00:00:00.000Z",
          county: "franklin",
          zip: "63084",
          schoolDistrict: "2900001",
          geoSource: "voterfile",
          voterSegment: "MOBILIZE",
          voterT: 4,
          voterPp: 3,
          voterParty: "REP",
          banked: false,
        },
      ],
    });
    const [row] = await listConsent();
    expect(row).toMatchObject({
      phone: "+15555550001",
      status: "opted_in",
      county: "franklin",
      zip: "63084",
      schoolDistrict: "2900001",
      voterSegment: "MOBILIZE",
      voterT: 4,
      voterPp: 3,
      voterParty: "REP",
      banked: false,
    });
  });

  it("surfaces optedOutAt so opt-out rate is measurable", async () => {
    send.mockResolvedValue({
      Items: [{ SK: "+15555550002", status: "opted_out", optedOutAt: "2026-07-25T14:00:00.000Z" }],
    });
    const [row] = await listConsent();
    expect(row.optedOutAt).toBe("2026-07-25T14:00:00.000Z");
  });

  it("leaves absent tags undefined rather than defaulting them", async () => {
    // An unenriched row must stay UNKNOWN — a defaulted 0 propensity would read
    // as "never votes in primaries" and be swept up by a pp: filter.
    send.mockResolvedValue({ Items: [{ SK: "+15555550003", status: "opted_in" }] });
    const [row] = await listConsent();
    expect(row.voterPp).toBeUndefined();
    expect(row.voterParty).toBeUndefined();
    expect(row.banked).toBeUndefined();
  });
});
