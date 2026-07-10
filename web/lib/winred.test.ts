import { describe, it, expect } from "vitest";
import { normalizeWinred, extractWinredToken, classifyWinredEvent } from "@/lib/winred";

describe("classifyWinredEvent", () => {
  it("classifies created donations from common event fields", () => {
    expect(classifyWinredEvent({ event: "donation.created", amount: 100 })).toBe("created");
    expect(classifyWinredEvent({ type: "DonationCreated" })).toBe("created");
    expect(classifyWinredEvent({ status: "success" })).toBe("created");
  });

  it("classifies refunds (string event or refunded flag), top-level or nested", () => {
    expect(classifyWinredEvent({ event: "donation.refunded" })).toBe("refunded");
    expect(classifyWinredEvent({ data: { event_type: "Refund" } })).toBe("refunded");
    expect(classifyWinredEvent({ data: { refunded: true } })).toBe("refunded");
    expect(classifyWinredEvent({ refunded_at: "2026-06-21T00:00:00Z" })).toBe("refunded");
  });

  it("classifies a lost dispute as its own kind (also a reversal)", () => {
    expect(classifyWinredEvent({ event: "donation.dispute_lost" })).toBe("dispute_lost");
    expect(classifyWinredEvent({ type: "DisputeLost" })).toBe("dispute_lost");
  });

  it("returns unknown when no event signal is present (route treats as a gift if it has an amount)", () => {
    expect(classifyWinredEvent({ amount: 2500, donor: { email: "a@b.co" } })).toBe("unknown");
  });
});

describe("extractWinredToken", () => {
  it("reads the static `token` field from the top level of the body (WinRed's mechanism)", () => {
    expect(extractWinredToken({ token: "s3cret", amount: 100 }, null, null)).toBe("s3cret");
  });

  it("reads `token` nested under a { data: {...} } envelope", () => {
    expect(extractWinredToken({ data: { token: "s3cret" } }, null, null)).toBe("s3cret");
  });

  it("prefers the body token over header fallbacks", () => {
    expect(extractWinredToken({ token: "body" }, "Bearer hdr", "xhdr")).toBe("body");
  });

  it("falls back to a Bearer Authorization header for manual/direct posts", () => {
    expect(extractWinredToken({ amount: 100 }, "Bearer hdrtok", null)).toBe("hdrtok");
  });

  it("falls back to x-winred-token when no body token or bearer is present", () => {
    expect(extractWinredToken({ amount: 100 }, null, "xtok")).toBe("xtok");
  });

  it("returns empty string when no token is present anywhere (→ 401 upstream)", () => {
    expect(extractWinredToken({ amount: 100, email: "a@b.co" }, null, null)).toBe("");
  });

  it("ignores a non-string/empty token field", () => {
    expect(extractWinredToken({ token: "" }, null, null)).toBe("");
    expect(extractWinredToken({ token: 12345 as unknown as string }, null, null)).toBe("");
  });
});

describe("normalizeWinred", () => {
  it("parses the documented nested-donor shape (plain `amount` is dollars)", () => {
    const r = normalizeWinred({
      id: "wr_abc",
      amount: 35,
      recurring: true,
      created_at: "2026-06-19T00:00:00Z",
      donor: { first_name: "Jane", last_name: "Doe", email: "jane@example.com", employer: "Acme", occupation: "Engineer", city: "STL", state: "MO", zip: "63101" },
    });
    expect(r).toMatchObject({
      externalId: "wr_abc",
      amount: 35, // plain `amount` → dollars (not 1/100 of the gift)
      name: "Jane Doe",
      email: "jane@example.com",
      employer: "Acme",
      state: "MO",
      recurring: true,
      donatedAt: "2026-06-19T00:00:00Z",
    });
  });

  it("reads an explicitly cents-named field as integer cents", () => {
    expect(normalizeWinred({ amount_cents: 3500, email: "a@b.co" }).amount).toBe(35);
    expect(normalizeWinred({ amount_in_cents: 5000, email: "a@b.co" }).amount).toBe(50);
  });

  it("parses string and $-formatted dollar amounts (no 100× shrink)", () => {
    expect(normalizeWinred({ amount: "25.00", email: "a@b.co" }).amount).toBe(25);
    expect(normalizeWinred({ amount: "250", email: "a@b.co" }).amount).toBe(250);
    expect(normalizeWinred({ amount: "$1,250.00", email: "a@b.co" }).amount).toBe(1250);
  });

  it("unwraps a { data: {...} } envelope and reads flat billing fields (total_amount in dollars)", () => {
    const r = normalizeWinred({ data: { transaction_id: "t1", total_amount: 1000, billing: { first_name: "Sam", email: "sam@x.co" } } });
    expect(r.externalId).toBe("t1");
    expect(r.amount).toBe(1000);
    expect(r.name).toBe("Sam");
    expect(r.email).toBe("sam@x.co");
  });

  it("treats a missing/zero/negative amount as undefined (no phantom $0 gift)", () => {
    expect(normalizeWinred({ email: "a@b.co" }).amount).toBeUndefined();
    expect(normalizeWinred({ amount: 0, email: "a@b.co" }).amount).toBeUndefined();
    expect(normalizeWinred({ amount: -50, email: "a@b.co" }).amount).toBeUndefined();
  });

  it("defaults recurring to false and omits name when no parts are present", () => {
    const r = normalizeWinred({ amount: 500, email: "x@y.co" });
    expect(r.recurring).toBe(false);
    expect(r.name).toBeUndefined();
  });

  it("trims and ignores blank strings", () => {
    const r = normalizeWinred({ amount: 500, donor: { first_name: "  Pat  ", last_name: "   ", email: "pat@x.co" } });
    expect(r.firstName).toBe("Pat");
    expect(r.lastName).toBeUndefined();
    expect(r.name).toBe("Pat");
  });

  it("is robust to a junk payload (returns no amount/email rather than throwing)", () => {
    const r = normalizeWinred({ random: { nested: true }, list: [1, 2, 3] });
    expect(r.amount).toBeUndefined();
    expect(r.email).toBeUndefined();
    expect(r.recurring).toBe(false);
  });

  it("parses a donor phone across the common field-name variants", () => {
    expect(normalizeWinred({ amount: 5, donor: { phone: "314-555-0100", email: "a@b.co" } }).phone).toBe("314-555-0100");
    expect(normalizeWinred({ amount: 5, phone_number: "3145550100", email: "a@b.co" }).phone).toBe("3145550100");
    expect(normalizeWinred({ data: { total_amount: 5, billing: { phone: "+13145550100", email: "a@b.co" } } }).phone).toBe("+13145550100");
    expect(normalizeWinred({ amount: 5, email: "a@b.co" }).phone).toBeUndefined(); // absent → undefined
  });

  it("reads the SMS-consent flag ONLY when explicitly truthy (donation is not consent by itself)", () => {
    // Truthy encodings → true
    expect(normalizeWinred({ amount: 5, sms_opt_in: true, email: "a@b.co" }).smsConsent).toBe(true);
    expect(normalizeWinred({ amount: 5, sms_consent: "yes", email: "a@b.co" }).smsConsent).toBe(true);
    expect(normalizeWinred({ amount: 5, text_opt_in: "1", email: "a@b.co" }).smsConsent).toBe(true);
    // Falsy / absent → not consent
    expect(normalizeWinred({ amount: 5, sms_opt_in: false, email: "a@b.co" }).smsConsent).toBe(false);
    expect(normalizeWinred({ amount: 5, email: "a@b.co" }).smsConsent).toBeUndefined(); // no field → no text
  });

  it("finds the SMS-consent flag inside a custom-fields array (name mentions sms/text)", () => {
    const r = normalizeWinred({
      amount: 5,
      email: "a@b.co",
      custom_fields: [
        { name: "Employer", value: "Acme" },
        { name: "Text message updates", value: "true" },
      ],
    });
    expect(r.smsConsent).toBe(true);
  });

  // CONFIRMED account mapping (from the operator): the live WinRed webhook carries the
  // phone at `donor.phone` and the SMS-consent checkbox at top-level `sms_opt_in`. This pins
  // that exact shape so a future refactor of the candidate lists can't silently break the
  // donor thank-you text (which is gated on both fields).
  it("parses the CONFIRMED live shape: donor.phone + sms_opt_in", () => {
    const checked = normalizeWinred({
      id: "wr_live_1",
      amount: 25,
      donor: { first_name: "Dana", last_name: "Reed", email: "dana@example.com", phone: "314-555-0142" },
      sms_opt_in: true,
    });
    expect(checked.phone).toBe("314-555-0142");
    expect(checked.firstName).toBe("Dana");
    expect(checked.smsConsent).toBe(true); // → records consent + sends the thank-you text

    // Box left unchecked → no consent, so no donor text goes out.
    const unchecked = normalizeWinred({
      id: "wr_live_2",
      amount: 25,
      donor: { first_name: "Dana", email: "dana@example.com", phone: "314-555-0142" },
      sms_opt_in: false,
    });
    expect(unchecked.phone).toBe("314-555-0142");
    expect(unchecked.smsConsent).toBe(false);
  });
});
