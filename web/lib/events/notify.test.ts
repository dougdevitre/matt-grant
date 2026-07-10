import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock notify.ts's collaborators so we can assert orchestration without AWS/queues.
vi.mock("@/lib/email/audiences", () => ({ resolveRecipients: vi.fn() }));
vi.mock("@/lib/campaigns", () => ({ createCampaign: vi.fn() }));
vi.mock("@/lib/sms/audiences", () => ({ resolveSmsRecipients: vi.fn() }));
vi.mock("@/lib/sms/campaigns", () => ({ createSmsCampaign: vi.fn() }));
vi.mock("@/lib/sms/templates", () => ({ withCompliance: (s: string) => s }));
vi.mock("@/lib/events", () => ({ claimNotify: vi.fn(), EVENT_TYPE_LABELS: { rally: "Rally" } }));

import { publishEventNotifications } from "./notify";
import { resolveRecipients } from "@/lib/email/audiences";
import { createCampaign } from "@/lib/campaigns";
import { resolveSmsRecipients } from "@/lib/sms/audiences";
import { createSmsCampaign } from "@/lib/sms/campaigns";
import { claimNotify } from "@/lib/events";
import type { EventRow } from "@/lib/events/types";

const ev = {
  id: "e1", title: "Rally", type: "rally", start: "2026-07-12T23:00:00.000Z",
  location: { name: "Park", address: "", city: "Chesterfield", county: "" }, description: "Come",
} as EventRow;

beforeEach(() => vi.clearAllMocks());

describe("publishEventNotifications", () => {
  it("queues email + SMS when claimed and recipients exist", async () => {
    vi.mocked(claimNotify).mockResolvedValue(true);
    vi.mocked(resolveRecipients).mockResolvedValue({ recipients: [{ email: "a@x.org" }], internal: 0 } as any);
    vi.mocked(resolveSmsRecipients).mockResolvedValue([{ phone: "+15550000000" }]);

    const r = await publishEventNotifications(ev, "me");

    expect(r.email.queued).toBe(true);
    expect(r.sms.queued).toBe(true);
    expect(vi.mocked(createCampaign)).toHaveBeenCalledWith(expect.objectContaining({ templateKey: "event", topic: "events" }));
    expect(vi.mocked(createSmsCampaign)).toHaveBeenCalledOnce();
  });

  it("reports reasons (not errors) when there are no recipients, and queues nothing", async () => {
    vi.mocked(claimNotify).mockResolvedValue(true);
    vi.mocked(resolveRecipients).mockResolvedValue({ recipients: [], internal: 0 } as any);
    vi.mocked(resolveSmsRecipients).mockResolvedValue([]);

    const r = await publishEventNotifications(ev, "me");

    expect(r.email).toEqual({ queued: false, reason: "no email recipients" });
    expect(r.sms).toEqual({ queued: false, reason: "no opted-in volunteer numbers" });
    expect(vi.mocked(createCampaign)).not.toHaveBeenCalled();
  });

  it("is idempotent — already-claimed channels report 'already notified'", async () => {
    vi.mocked(claimNotify).mockResolvedValue(false);
    const r = await publishEventNotifications(ev, "me");
    expect(r.email.reason).toBe("already notified");
    expect(r.sms.reason).toBe("already notified");
  });
});
