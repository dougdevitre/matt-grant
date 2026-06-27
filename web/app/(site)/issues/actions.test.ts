import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the request-scoped IP source and the rate limiter so we can exercise the
// throttle branch of commitToIssue without Next's request context or DynamoDB.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { createSubmission, issueBoardConfigured } = vi.hoisted(() => ({
  createSubmission: vi.fn(),
  issueBoardConfigured: vi.fn(),
}));

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
vi.mock("@/lib/issue-board/airtable", () => ({ createSubmission, issueBoardConfigured }));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { email: "mattgrantforcongress@gmail.com" } }));
vi.mock("@/lib/sms/send", () => ({ toE164: () => null }));
vi.mock("@/lib/sms/consent", () => ({ recordConsent: vi.fn() }));

import { commitToIssue, submitTopic } from "./actions";

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
  issueBoardConfigured.mockResolvedValue(true);
  createSubmission.mockResolvedValue(undefined);
});

const topicForm = () => {
  const fd = new FormData();
  fd.set("topic", "Veterans' access to care");
  fd.set("details", "This matters to my family and our neighborhood.");
  fd.set("email", "pat@example.com");
  return fd;
};

describe("submitTopic", () => {
  it("honeypot filled → fakes success and never writes to Airtable", async () => {
    const fd = topicForm();
    fd.set("company", "spam-bot inc");
    const res = await submitTopic(null, fd);
    expect(res.ok).toBe(true);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("missing topic → rejects before any write", async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 5, resetAt: 0 });
    const fd = topicForm();
    fd.delete("topic");
    const res = await submitTopic(null, fd);
    expect(res.ok).toBe(false);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("board not configured → honest error, no write", async () => {
    issueBoardConfigured.mockResolvedValue(false);
    const res = await submitTopic(null, topicForm());
    expect(res.ok).toBe(false);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("over the rate limit → refuses and never submits", async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 6, limit: 5, resetAt: 0 });
    const res = await submitTopic(null, topicForm());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/too many/i);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("valid + under the limit → submits to Airtable as a pending topic", async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 5, resetAt: 0 });
    const res = await submitTopic(null, topicForm());
    expect(res.ok).toBe(true);
    expect(createSubmission).toHaveBeenCalledOnce();
    expect(createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "Veterans' access to care", email: "pat@example.com" }),
    );
  });

  it("Airtable write throws → surfaces an error to the supporter", async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 5, resetAt: 0 });
    createSubmission.mockRejectedValue(new Error("airtable 422"));
    const res = await submitTopic(null, topicForm());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/went wrong/i);
  });

  it("malformed email → rejected before any write", async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 5, resetAt: 0 });
    const fd = topicForm();
    fd.set("email", "not-an-email");
    const res = await submitTopic(null, fd);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/valid email/i);
    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("oversized name/city → capped server-side before the write", async () => {
    rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 5, resetAt: 0 });
    const fd = topicForm();
    fd.set("name", "a".repeat(5000));
    fd.set("city", "b".repeat(5000));
    const res = await submitTopic(null, fd);
    expect(res.ok).toBe(true);
    const arg = createSubmission.mock.calls[0][0];
    expect(arg.name.length).toBe(100);
    expect(arg.city.length).toBe(100);
  });
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
