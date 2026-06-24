import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the infra the action touches; keep @/lib/rbac REAL so the capability
// gate is genuinely exercised (member has manageVolunteers; partner does not).
const send = vi.fn();
const staffGate = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/db", () => ({
  ddb: { send: (c: unknown) => send(c) },
  TABLE: "test-table",
  PK: { volunteers: "VOL" },
  newId: () => "generated-id",
  dbConfigured: true,
}));
vi.mock("@/lib/donors", () => ({ recordContribution: vi.fn() }));
vi.mock("@/lib/onboarding", () => ({ dismissOnboarding: vi.fn() }));

import { updateVolunteerNotes } from "./actions";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const inputOf = () => (send.mock.calls[0][0] as { input: Record<string, unknown> }).input;

beforeEach(() => {
  vi.clearAllMocks();
  staffGate.mockResolvedValue({ role: "member", email: "m@x.test" });
  send.mockResolvedValue({});
});

describe("updateVolunteerNotes", () => {
  it("writes the notes for an authorized role, aliasing the reserved-word-safe field", async () => {
    await updateVolunteerNotes(fd({ id: "v1", notes: "Met at the county fair" }));
    expect(send).toHaveBeenCalledOnce();
    const input = inputOf();
    expect(input.Key).toEqual({ PK: "VOL", SK: "v1" });
    expect(input.UpdateExpression).toBe("SET #n = :n");
    expect(input.ExpressionAttributeNames).toEqual({ "#n": "notes" });
    expect(input.ExpressionAttributeValues).toEqual({ ":n": "Met at the county fair" });
  });

  it("clears the notes when the submission is blank (empty → null, not a no-op)", async () => {
    await updateVolunteerNotes(fd({ id: "v1", notes: "   " }));
    expect((inputOf().ExpressionAttributeValues as Record<string, unknown>)[":n"]).toBeNull();
  });

  it("clamps very long notes to 2000 chars", async () => {
    await updateVolunteerNotes(fd({ id: "v1", notes: "x".repeat(5000) }));
    expect((inputOf().ExpressionAttributeValues as Record<string, string>)[":n"]).toHaveLength(2000);
  });

  it("no-ops without an id (never writes)", async () => {
    await updateVolunteerNotes(fd({ notes: "orphan note" }));
    expect(send).not.toHaveBeenCalled();
  });

  it("forbids a role lacking manageVolunteers and never writes", async () => {
    staffGate.mockResolvedValue({ role: "partner", email: "p@x.test" });
    await expect(updateVolunteerNotes(fd({ id: "v1", notes: "x" }))).rejects.toThrow(/Forbidden/);
    expect(send).not.toHaveBeenCalled();
  });
});
