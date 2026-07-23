import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
// Mock the two data sources so we can assert the readiness reduction without DynamoDB.
vi.mock("@/lib/db", () => ({
  TABLE: "test-table",
  dbConfigured: true,
  queryAllPages: vi.fn(),
}));
vi.mock("@/lib/voters/store", () => ({
  listVoterAggs: vi.fn(),
}));

import { smsInsightsReadiness } from "./smsInsights";
import { queryAllPages } from "@/lib/db";
import { listVoterAggs } from "@/lib/voters/store";

const mockConsent = vi.mocked(queryAllPages);
const mockAggs = vi.mocked(listVoterAggs) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("smsInsightsReadiness", () => {
  it("empty everything → not ready, 0% scored", async () => {
    mockConsent.mockResolvedValue([]);
    mockAggs.mockResolvedValue([]);
    const r = await smsInsightsReadiness();
    expect(r).toMatchObject({ configured: true, voterFileLoaded: false, optedIn: 0, scored: 0, scoredPct: 0, lastEnrichedAt: null, ready: false });
  });

  it("voter file loaded but nothing enriched → not ready", async () => {
    mockConsent.mockResolvedValue([
      { SK: "+13145550100", status: "opted_in" },
      { SK: "+13145550101", status: "opted_in" },
    ]);
    mockAggs.mockResolvedValue([{ precinctKey: "p1", count: 100 }]);
    const r = await smsInsightsReadiness();
    expect(r.voterFileLoaded).toBe(true);
    expect(r.optedIn).toBe(2);
    expect(r.scored).toBe(0);
    expect(r.ready).toBe(false); // loaded, but no scored rows yet
  });

  it("counts only opted-in rows as scored; opted-out ignored", async () => {
    mockConsent.mockResolvedValue([
      { SK: "+13145550100", status: "opted_in", voterSegment: "MOBILIZE", enrichedAt: "2026-07-22T10:00:00.000Z" },
      { SK: "+13145550101", status: "opted_in" }, // opted-in, unscored
      { SK: "+13145550102", status: "opted_out", voterSegment: "BANK" }, // opted-out: not counted
    ]);
    mockAggs.mockResolvedValue([{ precinctKey: "p1", count: 100 }]);
    const r = await smsInsightsReadiness();
    expect(r.optedIn).toBe(2);
    expect(r.scored).toBe(1);
    expect(r.scoredPct).toBeCloseTo(50, 5);
    expect(r.ready).toBe(true);
  });

  it("reports the MOST RECENT enrichedAt across the ledger", async () => {
    mockConsent.mockResolvedValue([
      { SK: "+13145550100", status: "opted_in", voterSegment: "BANK", enrichedAt: "2026-07-20T00:00:00.000Z" },
      { SK: "+13145550101", status: "opted_in", voterSegment: "MOBILIZE", enrichedAt: "2026-07-23T00:00:00.000Z" },
    ]);
    mockAggs.mockResolvedValue([{ precinctKey: "p1", count: 100 }]);
    const r = await smsInsightsReadiness();
    expect(r.lastEnrichedAt).toBe("2026-07-23T00:00:00.000Z");
  });
});
