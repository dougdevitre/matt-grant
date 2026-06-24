import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the request-scoped IP source and the rate limiter so we can exercise the
// throttle branch of commitToIssue without Next's request context or DynamoDB.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => "203.0.113.9" }),
}));
vi.mock("@/lib/ratelimit", () => ({ rateLimit }));
vi.mock("@/lib/db", () => ({
  ddb: { send },
  TABLE: "test-table",
  PK: { volunteers: "VOL" },
  newId: () => "fixed-id",
  dbConfigured: true,
}));
// SES off → skip the welcome-email path entirely.
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(), sesEnabled: false }));
vi.mock("@/lib/email/templates", () => ({
  volunteerWelcome: () => ({ subject: "s", html: "h", text: "t" }),
}));

import { commitToIssue } from "./actions";

const form = () => {
  const fd = new FormData();
  fd.set("name", "Pat Voter");
  fd.set("email", "pat@example.com");
  fd.set("issueLabel", "Family Courts");
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({});
});

describe("commitToIssue rate limiting", () => {
  it("over the limit, refuses and never writes a lead", async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 11, limit: 10, resetAt: 0 });
    const res = await commitToIssue(null, form());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/too many/i);
    expect(send).not.toHaveBeenCalled();
  });

  it("under the limit, records the commitment", async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 10, resetAt: 0 });
    const res = await commitToIssue(null, form());
    expect(res.ok).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });
});
