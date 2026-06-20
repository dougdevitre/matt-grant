import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// staffGate reads env at module load (clerkEnabled, allowlist, ALLOW_OPEN_DASHBOARD)
// and dynamically imports Clerk + the staff store. So each case sets env, resets
// modules, mocks those dynamic imports, then imports a fresh copy.

const ORIG = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.DASHBOARD_ALLOWLIST;
  delete process.env.ALLOW_OPEN_DASHBOARD;
});

afterEach(() => {
  process.env = { ...ORIG };
  vi.resetModules();
});

function enableClerk() {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
  process.env.CLERK_SECRET_KEY = "sk_test_x";
}

async function gateWith({ user, dbRole }: { user?: unknown; dbRole?: string | null } = {}) {
  vi.doMock("@clerk/nextjs/server", () => ({ currentUser: async () => user ?? null }));
  vi.doMock("@/lib/staff", () => ({ staffRole: async () => dbRole ?? null }));
  const { staffGate } = await import("@/lib/auth");
  return staffGate();
}

const userWith = (email: string, role?: string) => ({
  primaryEmailAddress: { emailAddress: email },
  ...(role ? { publicMetadata: { role } } : {}),
});

describe("staffGate role resolution", () => {
  it("demo mode (no Clerk) → admin, open", async () => {
    expect(await gateWith()).toEqual({ ok: true, email: null, role: "admin" });
  });

  it("env allowlist wins → admin (case-insensitive)", async () => {
    enableClerk();
    process.env.DASHBOARD_ALLOWLIST = "boss@x.co, other@x.co";
    const g = await gateWith({ user: userWith("Boss@X.co", "organizer") });
    expect(g).toMatchObject({ ok: true, role: "admin" }); // allowlist beats the metadata role
  });

  it("falls back to Clerk publicMetadata.role", async () => {
    enableClerk();
    const g = await gateWith({ user: userWith("cap@x.co", "captain") });
    expect(g).toMatchObject({ ok: true, role: "captain" });
  });

  it("falls back to the DynamoDB staff row when no metadata role", async () => {
    enableClerk();
    const g = await gateWith({ user: userWith("org@x.co"), dbRole: "organizer" });
    expect(g).toMatchObject({ ok: true, role: "organizer" });
  });

  it("denies a signed-in user who is in none of the sources", async () => {
    enableClerk();
    const g = await gateWith({ user: userWith("nobody@x.co"), dbRole: null });
    expect(g).toEqual({ ok: false, email: "nobody@x.co", role: null });
  });

  it("fails closed: empty allowlist does NOT grant everyone admin", async () => {
    enableClerk(); // DASHBOARD_ALLOWLIST unset, ALLOW_OPEN_DASHBOARD unset
    const g = await gateWith({ user: userWith("random@x.co"), dbRole: null });
    expect(g.ok).toBe(false);
    expect(g.role).not.toBe("admin");
  });

  it("ALLOW_OPEN_DASHBOARD=true is the explicit escape hatch → admin", async () => {
    enableClerk();
    process.env.ALLOW_OPEN_DASHBOARD = "true";
    const g = await gateWith({ user: userWith("anyone@x.co") });
    expect(g).toMatchObject({ ok: true, role: "admin" });
  });
});
