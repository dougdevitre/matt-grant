import { describe, it, expect, vi, beforeEach } from "vitest";

// team.ts is server-only; neutralize so we can unit-test the captain filter.
vi.mock("server-only", () => ({}));
const getVolunteers = vi.fn();
vi.mock("@/lib/queries", () => ({ getVolunteers: () => getVolunteers() }));

import { getCaptainTeam } from "./team";

const vol = (id: string, captainEmail: string | null) => ({ id, captainEmail });

beforeEach(() => vi.clearAllMocks());

describe("getCaptainTeam", () => {
  it("returns only volunteers claimed onto the given captain (case-insensitive)", async () => {
    getVolunteers.mockResolvedValue({
      connected: true,
      rows: [vol("a", "Cap@X.org"), vol("b", "other@x.org"), vol("c", "cap@x.org"), vol("d", null)],
    });
    const team = await getCaptainTeam("cap@x.org");
    expect(team.map((v) => v.id)).toEqual(["a", "c"]);
  });

  it("returns [] for a blank/undefined captain email (never the whole roster)", async () => {
    getVolunteers.mockResolvedValue({ connected: true, rows: [vol("a", "cap@x.org")] });
    expect(await getCaptainTeam("")).toEqual([]);
    expect(await getCaptainTeam(null)).toEqual([]);
    expect(await getCaptainTeam(undefined)).toEqual([]);
    // getVolunteers is not even queried when there's no identity to scope to.
    expect(getVolunteers).not.toHaveBeenCalled();
  });
});
