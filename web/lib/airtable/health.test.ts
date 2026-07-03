import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const getSecret = vi.fn();
vi.mock("@/lib/ssm", () => ({ getSecret: (...a: unknown[]) => getSecret(...a) }));
vi.mock("@/lib/airtable/registry", () => ({
  AIRTABLE_BASES: { volunteer: { id: "appVOL", accessTable: "tblACCESS", tables: { volunteers: "tblVOL" } } },
}));

import { checkAirtableHealth } from "./health";

const fetchMock = vi.fn();
beforeEach(() => {
  getSecret.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("checkAirtableHealth", () => {
  it("is 'setup' when no key is configured", async () => {
    getSecret.mockResolvedValue(undefined);
    const h = await checkAirtableHealth();
    expect(h.state).toBe("setup");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is 'live' when the volunteer base responds OK", async () => {
    getSecret.mockResolvedValue("key123");
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    expect((await checkAirtableHealth()).state).toBe("live");
    // probes the volunteer base's Front-End Access control table with a 1-record read
    expect(fetchMock.mock.calls[0][0]).toContain("appVOL/tblACCESS");
    expect(fetchMock.mock.calls[0][0]).toContain("maxRecords=1");
  });

  it("flags an expired/invalid key as an error (401)", async () => {
    getSecret.mockResolvedValue("key123");
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const h = await checkAirtableHealth();
    expect(h.state).toBe("error");
    expect(h.detail).toMatch(/401/);
  });

  it("flags the documented no-base-access fail-closed mode (403)", async () => {
    getSecret.mockResolvedValue("key123");
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const h = await checkAirtableHealth();
    expect(h.state).toBe("error");
    expect(h.detail).toMatch(/base appVOL/);
  });

  it("degrades gracefully when the request throws", async () => {
    getSecret.mockResolvedValue("key123");
    fetchMock.mockRejectedValue(new Error("network"));
    expect((await checkAirtableHealth()).state).toBe("error");
  });
});
