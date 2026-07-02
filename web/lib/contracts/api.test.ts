import { describe, it, expect, vi, afterEach } from "vitest";
import { apiOk, apiError, apiFail, unauthorized, forbidden } from "./api";

// The whole point of apiFail is to NOT leak internals: it logs the real error
// server-side and returns a generic client-safe body. Lock that in.

afterEach(() => vi.restoreAllMocks());

async function body(res: Response) {
  return res.json();
}

describe("api envelope", () => {
  it("apiOk returns the data as-is", async () => {
    const res = apiOk({ items: [1, 2] });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ items: [1, 2] });
  });

  it("apiError carries a client-safe message + status", async () => {
    const res = apiError("Forbidden", 403);
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: "Forbidden" });
  });

  it("apiFail logs the raw error server-side but never returns it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = new Error("s3://secret-bucket denied for arn:aws:iam::123");
    const res = apiFail(raw, "Upstream error", 502, "assets");
    expect(res.status).toBe(502);
    const json = await body(res);
    expect(json).toEqual({ error: "Upstream error" });
    expect(JSON.stringify(json)).not.toContain("secret-bucket"); // no leak
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("assets"), raw); // logged
  });

  it("unauthorized/forbidden are the standard 401/403", async () => {
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
  });
});
