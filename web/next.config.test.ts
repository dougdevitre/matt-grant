import { describe, it, expect } from "vitest";
import config from "./next.config.mjs";

// Guards the security headers on the synced pillar tools. These tool files are
// untrusted HTML imported from external access-to-* repos and embedded in a sandboxed
// iframe; the CSP is what stops a running tool from exfiltrating data or being framed
// elsewhere. A regression here would silently re-open that hole.
describe("next.config security headers", () => {
  it("applies a locked-down CSP + nosniff to /pillar-tools/*", async () => {
    const rules = await config.headers!();
    const rule = rules.find((r) => r.source === "/pillar-tools/:path*");
    expect(rule, "no header rule for /pillar-tools/:path*").toBeTruthy();

    const headers = Object.fromEntries(rule!.headers.map((h) => [h.key, h.value]));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");

    const csp = headers["Content-Security-Policy"];
    expect(csp).toBeTruthy();
    // The two directives that actually contain an untrusted tool.
    expect(csp).toContain("connect-src 'none'"); // can't phone home / exfiltrate
    expect(csp).toContain("frame-ancestors 'self'"); // only this app may embed it
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'none'");
  });
});
