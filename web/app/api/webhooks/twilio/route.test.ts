import { describe, it, expect, vi, beforeEach } from "vitest";

// Verify the inbound webhook alerts staff only on the FIRST unread of a FREEFORM
// thread — not on reserved keywords/CTAs, and not on later messages in a burst —
// and that the vote agent (VOTE keyword → county question → answer) runs its flow.
const validateTwilioSignature = vi.fn();
const logInbound = vi.fn();
const getConversation = vi.fn();
const setAwaitingGeo = vi.fn();
const setConversationGeo = vi.fn();
const recordConsentGeo = vi.fn();
const notifyStaffInboundText = vi.fn();
const resolveCta = vi.fn();

vi.mock("@/lib/ssm", () => ({ getSecret: vi.fn().mockResolvedValue(undefined) })); // keyword → MATT
vi.mock("@/lib/sms/send", () => ({ validateTwilioSignature: (...a: unknown[]) => validateTwilioSignature(...a) }));
vi.mock("@/lib/sms/consent", () => ({
  recordConsent: vi.fn(),
  recordOptOut: vi.fn(),
  recordConsentGeo: (...a: unknown[]) => recordConsentGeo(...a),
}));
vi.mock("@/lib/volunteers/optout", () => ({ setVolunteerContactOptOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/sms/moderation", () => ({ isBlocked: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/sms/conversations", () => ({
  logInbound: (...a: unknown[]) => logInbound(...a),
  getConversation: (...a: unknown[]) => getConversation(...a),
  setAwaitingGeo: (...a: unknown[]) => setAwaitingGeo(...a),
  setConversationGeo: (...a: unknown[]) => setConversationGeo(...a),
}));
vi.mock("@/lib/notifications/staffNotify", () => ({ notifyStaffInboundText: (...a: unknown[]) => notifyStaffInboundText(...a) }));
vi.mock("@/lib/sms/ctas", () => ({
  resolveCta: (...a: unknown[]) => resolveCta(...a),
  welcomeReply: () => "welcome",
  ctaLink: (p: string) => `https://s${p}`, // votebot builds its guide link through this
}));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { candidate: "Grant", email: "x@y.z", committee: "C", paidForBy: "Paid for by C." }, SITE_URL: "https://s" }));

import { POST } from "./route";

const req = (body: string) =>
  ({
    formData: async () => {
      const fd = new FormData();
      fd.set("From", "+13145550100");
      fd.set("Body", body);
      fd.set("MessageSid", "SM1");
      return fd;
    },
    headers: { get: () => "" },
    nextUrl: { pathname: "/api/webhooks/twilio" },
  }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  validateTwilioSignature.mockResolvedValue(true);
  resolveCta.mockReturnValue(null);
  logInbound.mockResolvedValue(1);
  getConversation.mockResolvedValue(null);
});

const bodyOf = async (res: Response) => await res.text();

describe("inbound webhook staff alert", () => {
  it("alerts on the first unread of a freeform text", async () => {
    await POST(req("hey can someone call me back"));
    expect(notifyStaffInboundText).toHaveBeenCalledTimes(1);
    expect(notifyStaffInboundText).toHaveBeenCalledWith(
      expect.objectContaining({ from: "+13145550100", bodySnippet: expect.stringContaining("call me back") }),
    );
  });

  it("does NOT alert on a later message in the same unread thread", async () => {
    logInbound.mockResolvedValue(3); // 3rd unread — staff already alerted on the 1st
    await POST(req("still waiting"));
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("does NOT alert on reserved keywords (STOP)", async () => {
    await POST(req("STOP"));
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("does NOT alert on a CTA keyword (DONATE)", async () => {
    resolveCta.mockReturnValue({ source: "sms-cta-donate", reply: "donate link" });
    await POST(req("DONATE"));
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("rejects an invalid Twilio signature with 403 and never logs", async () => {
    validateTwilioSignature.mockResolvedValue(false);
    const res = await POST(req("hello"));
    expect(res.status).toBe(403);
    expect(logInbound).not.toHaveBeenCalled();
  });
});

describe("vote agent flow", () => {
  const voteCta = { source: "sms-cta-vote", reply: "static vote link" };

  it("VOTE with no known county asks the county question and remembers it", async () => {
    resolveCta.mockReturnValue(voteCta);
    const res = await POST(req("VOTE"));
    expect(setAwaitingGeo).toHaveBeenCalledWith("+13145550100");
    const xml = await bodyOf(res as Response);
    expect(xml).toContain("Which county do you vote in?");
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("VOTE with a known county answers immediately with county-specific info", async () => {
    resolveCta.mockReturnValue(voteCta);
    getConversation.mockResolvedValue({ county: "franklin" });
    const res = await POST(req("VOTE"));
    expect(setAwaitingGeo).not.toHaveBeenCalled();
    const xml = await bodyOf(res as Response);
    expect(xml).toContain("Franklin County");
    expect(xml).toContain("636.583.6355");
  });

  it("a county answer to a live question is stored (convo + consent) and answered", async () => {
    getConversation.mockResolvedValue({ awaiting: "geo", awaitingAt: new Date().toISOString() });
    const res = await POST(req("Jefferson"));
    expect(setConversationGeo).toHaveBeenCalledWith("+13145550100", { county: "jefferson" });
    expect(recordConsentGeo).toHaveBeenCalledWith("+13145550100", { county: "jefferson" });
    const xml = await bodyOf(res as Response);
    expect(xml).toContain("Jefferson County");
    expect(notifyStaffInboundText).not.toHaveBeenCalled(); // handled by the agent
  });

  it("an unparseable answer gets the fallback link but still alerts staff", async () => {
    getConversation.mockResolvedValue({ awaiting: "geo", awaitingAt: new Date().toISOString() });
    const res = await POST(req("I have a question about yard signs"));
    expect(setConversationGeo).not.toHaveBeenCalled();
    const xml = await bodyOf(res as Response);
    expect(xml).toContain("vote/absentee"); // helpful fallback reply
    expect(notifyStaffInboundText).toHaveBeenCalledTimes(1); // human follows up
  });

  it("a freeform text with NO live question never triggers the agent", async () => {
    getConversation.mockResolvedValue({ county: undefined }); // ordinary thread
    await POST(req("63084"));
    expect(setConversationGeo).not.toHaveBeenCalled();
    expect(notifyStaffInboundText).toHaveBeenCalledTimes(1);
  });
});
