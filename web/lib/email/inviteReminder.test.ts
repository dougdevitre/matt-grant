import { describe, it, expect } from "vitest";
import { inviteReminder } from "@/lib/email/templates";

describe("inviteReminder", () => {
  it("embeds the accept URL in the button + text and greets by name", () => {
    const e = inviteReminder({ firstName: "Sam", acceptUrl: "https://clerk.example/accept/abc" });
    expect(e.subject).toMatch(/invitation/i);
    expect(e.html).toContain("https://clerk.example/accept/abc");
    expect(e.html).toContain("Sam");
    expect(e.text).toContain("https://clerk.example/accept/abc");
  });

  it("falls back to a neutral greeting and carries the committee footer", () => {
    const e = inviteReminder({ acceptUrl: "https://mattgrantforcongress.org/sign-in" });
    expect(e.html).not.toContain("undefined");
    expect(e.html).toMatch(/Matt Grant for Congress/); // layout footer / paid-for-by
  });

  it("is transactional — no unsubscribe link", () => {
    const e = inviteReminder({ acceptUrl: "https://mattgrantforcongress.org/sign-in" });
    expect(e.html).not.toMatch(/unsubscribe/i);
  });
});
