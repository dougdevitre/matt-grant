import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const getSecret = vi.fn();
vi.mock("@/lib/ssm", () => ({ getSecret: (...a: unknown[]) => getSecret(...a) }));

import { smsReadiness } from "./health";

beforeEach(() => getSecret.mockReset());

describe("smsReadiness", () => {
  it("is 'live' with all three Twilio secrets present", async () => {
    getSecret.mockResolvedValue("x");
    const r = await smsReadiness();
    expect(r.state).toBe("live");
    expect(r.presentCount).toBe(3);
    expect(r.missing).toEqual([]);
    expect(r.secrets.every((s) => s.present)).toBe(true);
  });

  it("is 'setup' and names the missing secret when one is absent", async () => {
    // Only the messaging-service SID is missing.
    getSecret.mockImplementation((name: string) =>
      Promise.resolve(name === "TWILIO_MESSAGING_SERVICE_SID" ? undefined : "x"),
    );
    const r = await smsReadiness();
    expect(r.state).toBe("setup");
    expect(r.presentCount).toBe(2);
    expect(r.missing).toEqual(["Messaging Service SID"]);
    expect(r.secrets.find((s) => s.key === "TWILIO_MESSAGING_SERVICE_SID")?.present).toBe(false);
  });

  it("is 'setup' with nothing configured", async () => {
    getSecret.mockResolvedValue(undefined);
    const r = await smsReadiness();
    expect(r.state).toBe("setup");
    expect(r.presentCount).toBe(0);
    expect(r.missing).toHaveLength(3);
  });

  it("never exposes secret values — only booleans", async () => {
    getSecret.mockResolvedValue("SUPER_SECRET_TOKEN");
    const r = await smsReadiness();
    expect(JSON.stringify(r)).not.toContain("SUPER_SECRET_TOKEN");
  });
});
