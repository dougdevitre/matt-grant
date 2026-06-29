import { describe, it, expect, vi, beforeEach } from "vitest";

// expressTaskInterest records a matched-task interest on the volunteer's OWN record
// and pings the RIGHT person — their team captain, else the campaign inbox. DB,
// notifications, and email are mocked.
vi.mock("server-only", () => ({}));
const send = vi.fn();
vi.mock("@/lib/db", () => ({ ddb: { send: (c: unknown) => send(c) }, TABLE: "T", PK: { volunteers: "VOL" }, dbConfigured: true }));
const staffGate = vi.fn();
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/profile", () => ({ saveProfile: vi.fn() }));
vi.mock("@/lib/volunteers/self", () => ({ getMyVolunteerProfile: vi.fn() }));
vi.mock("@/lib/volunteers/captains", () => ({ listActiveCaptains: vi.fn().mockResolvedValue([]), suggestCaptain: vi.fn() }));
const notifyCaptain = vi.fn();
vi.mock("@/lib/notifications/staffNotify", () => ({ notifyCaptainVolunteerInterest: (...a: unknown[]) => notifyCaptain(...a) }));
const sendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), sesEnabled: true }));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { email: "campaign@x.com" } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { expressTaskInterest } from "./actions";

const fd = (task: string) => { const f = new FormData(); f.set("task", task); return f; };
const inputOf = (i: number) => (send.mock.calls[i][0] as { input: Record<string, unknown> }).input;

beforeEach(() => {
  send.mockReset();
  staffGate.mockReset().mockResolvedValue({ email: "v@x.com" });
  notifyCaptain.mockReset().mockResolvedValue(undefined);
  sendEmail.mockReset().mockResolvedValue({});
});

describe("expressTaskInterest", () => {
  it("records the task and pings the volunteer's captain", async () => {
    send.mockResolvedValueOnce({ Item: { interestedTasks: [], captainEmail: "cap@x.com", name: "Dana" } }).mockResolvedValueOnce({});
    await expressTaskInterest(fd("Knock doors"));
    expect(inputOf(1).UpdateExpression).toContain("interestedTasks");
    expect(notifyCaptain).toHaveBeenCalledWith("cap@x.com", { name: "Dana", email: "v@x.com", task: "Knock doors" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("falls back to the campaign inbox when they have no team", async () => {
    send.mockResolvedValueOnce({ Item: { interestedTasks: [] } }).mockResolvedValueOnce({});
    await expressTaskInterest(fd("Knock doors"));
    expect(notifyCaptain).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "campaign@x.com" }));
  });

  it("is idempotent — already interested doesn't re-record or re-notify", async () => {
    send.mockResolvedValueOnce({ Item: { interestedTasks: ["knock doors"], captainEmail: "cap@x.com" } });
    await expressTaskInterest(fd("Knock doors"));
    expect(send).toHaveBeenCalledTimes(1); // only the Get, no Update
    expect(notifyCaptain).not.toHaveBeenCalled();
  });

  it("no volunteer record → nothing happens", async () => {
    send.mockResolvedValueOnce({});
    await expressTaskInterest(fd("Knock doors"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(notifyCaptain).not.toHaveBeenCalled();
  });

  it("empty task → no-op", async () => {
    await expressTaskInterest(fd("   "));
    expect(send).not.toHaveBeenCalled();
  });
});
