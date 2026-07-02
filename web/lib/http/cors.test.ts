import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAllowedOrigin, corsHeaders, preflight } from "./cors";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;

beforeEach(() => {
  process.env.EXTENSION_ORIGIN = `${EXT}, chrome-extension://second`;
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("cors allowlist", () => {
  it("accepts an allowlisted origin, rejects others and null", () => {
    expect(isAllowedOrigin(EXT)).toBe(true);
    expect(isAllowedOrigin("chrome-extension://second")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it("fail-closed when EXTENSION_ORIGIN is empty", () => {
    process.env.EXTENSION_ORIGIN = "";
    expect(isAllowedOrigin(EXT)).toBe(false);
  });

  it("emits credentialed ACAO for an allowed origin", () => {
    const h = corsHeaders(EXT);
    expect(h["Access-Control-Allow-Origin"]).toBe(EXT);
    expect(h["Access-Control-Allow-Credentials"]).toBe("true");
    expect(h["Access-Control-Allow-Methods"]).toContain("GET");
    expect(h["Access-Control-Allow-Headers"]).toContain("Authorization");
    expect(h["Vary"]).toBe("Origin");
  });

  it("emits NO ACAO for a disallowed origin (only Vary)", () => {
    const h = corsHeaders("https://evil.example");
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Access-Control-Allow-Credentials"]).toBeUndefined();
    expect(h["Vary"]).toBe("Origin");
  });

  it("preflight returns 204 with the origin's CORS headers", () => {
    const res = preflight(new Request("http://test/api/ext/overview", { headers: { origin: EXT } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("advertises the write verbs (incl. DELETE) in the preflight", () => {
    const methods = corsHeaders(EXT)["Access-Control-Allow-Methods"];
    for (const m of ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]) expect(methods).toContain(m);
  });

  it("preflight for a disallowed origin has no ACAO", () => {
    const res = preflight(new Request("http://test/api/ext/overview", { headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
