import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression guard for the RBAC fix: the research-member read routes must gate on
// the `viewResearch` capability (admin/captain), NOT a bare staffGate().ok that a
// signed-in supporter passes. We assert the DENIED path returns 403 and requests
// the right capability — hermetic, so the DynamoDB store is never reached.
const checkCap = vi.fn();
vi.mock("@/lib/auth", () => ({ checkCap: (cap: string) => checkCap(cap) }));
vi.mock("@/lib/integrations/legislative/store", () => ({
  getMember: vi.fn(),
  getBills: vi.fn(),
  getVotes: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ dbConfigured: true }));

import { GET as memberGET } from "./[bioguideId]/route";
import { GET as billsGET } from "./[bioguideId]/bills/route";
import { GET as votesGET } from "./[bioguideId]/votes/route";

const params = Promise.resolve({ bioguideId: "W000812" });
const req = new Request("http://test/api/research/member/W000812");

beforeEach(() => vi.clearAllMocks());

describe("/api/research/member/* capability gate", () => {
  it("member returns 403 for a non-researcher and checks viewResearch", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const res = await memberGET(req, { params });
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("viewResearch");
  });

  it("bills returns 403 for a non-researcher and checks viewResearch", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const res = await billsGET(req, { params });
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("viewResearch");
  });

  it("votes returns 403 for a non-researcher and checks viewResearch", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const res = await votesGET(req, { params });
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("viewResearch");
  });
});
