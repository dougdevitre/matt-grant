import { describe, it, expect } from "vitest";
import { donorThankYouEmail } from "@/lib/email/donorThankYou";

describe("donorThankYouEmail", () => {
  it("greets by first name and carries the tax notice + committee footer", () => {
    const e = donorThankYouEmail("Jane Doe");
    expect(e.subject).toMatch(/thank you/i);
    expect(e.html).toContain("Jane, thank you");
    expect(e.html).toMatch(/not deductible/i);
    expect(e.html).toMatch(/Matt Grant for Congress/); // layout footer / FEC line
    expect(e.text).toMatch(/not deductible/i);
  });

  it("handles a missing name without a dangling greeting or 'undefined'", () => {
    const e = donorThankYouEmail(null);
    expect(e.html).not.toContain("undefined");
    expect(e.html).toContain("thank you for your contribution");
  });

  it("escapes HTML in the donor name", () => {
    const e = donorThankYouEmail("<script>x</script> Bad");
    expect(e.html).not.toContain("<script>x");
    expect(e.html).toContain("&lt;script&gt;");
  });
});
