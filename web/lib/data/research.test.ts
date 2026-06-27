import { describe, it, expect, vi } from "vitest";

// Pin dbConfigured=false so this test deterministically exercises the degraded
// path. In keyless CI DYNAMODB_TABLE is unset so dbConfigured is false — but the
// Amplify build injects DYNAMODB_TABLE (dbConfigured true), which flips this onto
// the store-read branch and breaks the "not connected" assertion. Mock so it's
// hermetic regardless of environment.
vi.mock("@/lib/db", () => ({ TABLE: "", dbConfigured: false, ddb: { send: async () => ({}) }, PK: {}, newId: () => "test" }));

import { loadFieldResearch, loadCandidateResearch } from "@/lib/data/research";

// dbConfigured is mocked false above — exercises the degraded path: roster +
// alignment still present, no store reads attempted.
describe("loadFieldResearch", () => {
  it("degrades (store not connected) but still carries roster + alignment", async () => {
    const r = await loadFieldResearch("2026-06-24T00:00:00.000Z");
    expect(r.ok).toBe(true);
    expect(r.meta.kind).toBe("api");
    expect(r.meta.degraded?.reason).toMatch(/not connected/i);
    if (r.ok) {
      expect(r.data.field.length).toBeGreaterThan(0);
      expect(r.data.analysis.candidates.length).toBeGreaterThan(0);
    }
  });
});

describe("loadCandidateResearch", () => {
  it("returns null for an unknown candidate slug", async () => {
    expect(await loadCandidateResearch("nobody-not-a-real-slug")).toBeNull();
  });
});
