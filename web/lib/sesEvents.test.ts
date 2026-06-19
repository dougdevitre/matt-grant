import { describe, it, expect } from "vitest";
import { classifySesEvent } from "@/lib/sesEvents";

describe("classifySesEvent", () => {
  it("suppresses permanent bounces", () => {
    expect(
      classifySesEvent({ notificationType: "Bounce", bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "a@b.co" }, { emailAddress: "c@d.co" }] } }),
    ).toEqual({ kind: "suppress", emails: ["a@b.co", "c@d.co"], reason: "bounced" });
  });

  it("does NOT suppress transient bounces (mailbox full / greylisting)", () => {
    expect(
      classifySesEvent({ notificationType: "Bounce", bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: "a@b.co" }] } }),
    ).toEqual({ kind: "ignore" });
  });

  it("suppresses complaints with reason=complained", () => {
    expect(
      classifySesEvent({ eventType: "Complaint", complaint: { complainedRecipients: [{ emailAddress: "x@y.co" }] } }),
    ).toEqual({ kind: "suppress", emails: ["x@y.co"], reason: "complained" });
  });

  it("maps Delivery/Open/Click to engagement using the campaign_id tag", () => {
    const tags = { campaign_id: ["camp_1"] };
    expect(classifySesEvent({ eventType: "Delivery", mail: { tags } })).toEqual({ kind: "engagement", campaignId: "camp_1", event: "delivered" });
    expect(classifySesEvent({ eventType: "Open", mail: { tags } })).toEqual({ kind: "engagement", campaignId: "camp_1", event: "open" });
    expect(classifySesEvent({ eventType: "Click", mail: { tags } })).toEqual({ kind: "engagement", campaignId: "camp_1", event: "click" });
  });

  it("ignores engagement events with no campaign_id tag", () => {
    expect(classifySesEvent({ eventType: "Open", mail: { tags: {} } })).toEqual({ kind: "ignore" });
    expect(classifySesEvent({ eventType: "Open" })).toEqual({ kind: "ignore" });
  });

  it("ignores recipient-less bounce/complaint and unknown event types", () => {
    expect(classifySesEvent({ notificationType: "Bounce", bounce: { bounceType: "Permanent", bouncedRecipients: [] } })).toEqual({ kind: "ignore" });
    expect(classifySesEvent({ eventType: "Complaint", complaint: { complainedRecipients: [{}] } })).toEqual({ kind: "ignore" });
    expect(classifySesEvent({ eventType: "Reject" })).toEqual({ kind: "ignore" });
    expect(classifySesEvent({})).toEqual({ kind: "ignore" });
  });
});
