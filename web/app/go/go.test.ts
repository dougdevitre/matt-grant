import { vi, describe, it, expect, afterEach } from "vitest";
import type { Role } from "@/lib/rbac";

// The post-auth router (app/go/page.tsx) is where a freshly signed-in user — including
// anyone who signed in with Google / Facebook / LinkedIn — is sent. This exercises the
// whole GoPage → staffGate() → postAuthDestination() → redirect() path with staffGate
// mocked per role, so it's the closest automated proxy to "after successful
// authentication the user lands on the dashboard." (redirect itself is real Next magic
// that throws; we mock it to a spy so we can assert the target.)

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function runGoFor(role: Role | null): Promise<string> {
  vi.resetModules();
  const redirect = vi.fn();
  vi.doMock("next/navigation", () => ({ redirect }));
  // Only `role` matters to GoPage; the rest of the Gate is irrelevant here.
  vi.doMock("@/lib/auth", () => ({ staffGate: async () => ({ role }) }));
  const { default: GoPage } = await import("./page");
  await GoPage();
  expect(redirect).toHaveBeenCalledTimes(1);
  return redirect.mock.calls[0][0] as string;
}

describe("GoPage post-auth redirect", () => {
  it("sends staff (admin/captain/volunteer) to the dashboard", async () => {
    expect(await runGoFor("admin")).toBe("/dashboard");
    expect(await runGoFor("captain")).toBe("/dashboard");
    expect(await runGoFor("volunteer")).toBe("/dashboard");
  });

  it("sends Peace-Room tiers (partner/donor/supporter) to the shared board", async () => {
    expect(await runGoFor("partner")).toBe("/dashboard/peace-room");
    expect(await runGoFor("donor")).toBe("/dashboard/peace-room");
    expect(await runGoFor("supporter")).toBe("/dashboard/peace-room");
  });

  it("sends a not-yet-stamped signup to the public community floor", async () => {
    expect(await runGoFor(null)).toBe("/community");
  });
});
