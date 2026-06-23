import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cronAuthorized } from "@/lib/cron-auth";
import { _clearSecretCache } from "@/lib/ssm";

// getSecret reads process.env first, so setting CRON_SECRET configures the gate
// in-test (mirrors the env-first pattern in publish.test.ts).
const reqWith = (auth?: string) => new Request("https://x/", auth ? { headers: { authorization: auth } } : undefined);

describe("cronAuthorized", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    _clearSecretCache();
  });

  describe("with CRON_SECRET configured", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "s3cret-value";
      _clearSecretCache();
    });

    it("accepts the correct Bearer token", async () => {
      expect(await cronAuthorized(reqWith("Bearer s3cret-value"))).toBe(true);
    });

    it("is case-insensitive on the Bearer prefix", async () => {
      expect(await cronAuthorized(reqWith("bearer s3cret-value"))).toBe(true);
    });

    it("rejects a wrong token", async () => {
      expect(await cronAuthorized(reqWith("Bearer nope"))).toBe(false);
    });

    it("rejects a missing Authorization header", async () => {
      expect(await cronAuthorized(reqWith())).toBe(false);
    });

    it("rejects an empty Bearer", async () => {
      expect(await cronAuthorized(reqWith("Bearer "))).toBe(false);
    });

    it("does not throw on a length-mismatched token (guards timingSafeEqual)", async () => {
      await expect(cronAuthorized(reqWith("Bearer x"))).resolves.toBe(false);
    });
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    // no CRON_SECRET in env
    expect(await cronAuthorized(reqWith("Bearer anything"))).toBe(false);
  });
});
