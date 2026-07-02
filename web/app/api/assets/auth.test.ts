import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression guard for the RBAC fix: /api/assets/* must gate on the
// `manageAssets` capability, NOT a bare staffGate().ok (which any signed-in
// supporter passes). We assert the DENIED path returns 403 and that each route
// asks for the right capability — hermetic, so no S3/AWS is touched.
const checkCap = vi.fn();
vi.mock("@/lib/auth", () => ({ checkCap: (cap: string) => checkCap(cap) }));
// Stores are never reached on the denied path, but stub them so the modules load.
vi.mock("@/lib/s3", () => ({ listAssets: vi.fn(), listPhotos: vi.fn(), s3Configured: true }));
vi.mock("@/lib/assets", () => ({ setAssetTags: vi.fn() }));

import { GET as listGET } from "./list/route";
import { GET as photosGET } from "./photos/route";
import { POST as tagsPOST } from "./tags/route";

beforeEach(() => vi.clearAllMocks());

describe("/api/assets/* capability gate", () => {
  it("list returns 403 for a non-manager and checks manageAssets", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const res = await listGET();
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("manageAssets");
  });

  it("photos returns 403 for a non-manager and checks manageAssets", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const res = await photosGET();
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("manageAssets");
  });

  it("tags (write) returns 403 for a non-manager and checks manageAssets", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const req = new Request("http://test/api/assets/tags", {
      method: "POST",
      body: JSON.stringify({ key: "public/x.png", tags: ["a"] }),
    });
    const res = await tagsPOST(req);
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("manageAssets");
  });
});
