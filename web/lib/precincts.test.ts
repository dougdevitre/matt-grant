import { describe, it, expect, vi, afterEach } from "vitest";
import { attachScores, fetchArcgisPaged, scoreRows, type PrecinctRow } from "./precincts";

// ArcGIS FeatureServers cap a single query at their server-side maxRecordCount
// (commonly 1000) and flag more rows via exceededTransferLimit. fetchArcgisPaged
// must page to completion, advancing the offset by the rows ACTUALLY returned —
// the bug being pinned is `offset += page` (requested size), which skips every
// record between what the server returned and the next requested offset.
const makeRes = (features: unknown[], exceeded: boolean) => ({
  ok: true,
  json: async () => ({ features, ...(exceeded ? { exceededTransferLimit: true } : {}) }),
});
const feats = (n: number) => Array.from({ length: n }, (_, i) => ({ attributes: { precinct: `p${i}` } }));

describe("fetchArcgisPaged", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pages to completion, stepping offset by rows returned when the server cap is below the page size", async () => {
    // Server returns 1000/page even though we ask for 2000, flagging exceeded until
    // the final short page (2500 rows total across three pages).
    const offsets: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("resultOffset"));
      offsets.push(offset);
      if (offset === 0) return makeRes(feats(1000), true);
      if (offset === 1000) return makeRes(feats(1000), true);
      if (offset === 2000) return makeRes(feats(500), false);
      return makeRes([], false);
    }));

    const out = await fetchArcgisPaged("https://arcgis.test/query", { where: "1=1", f: "json" });
    expect(out).toHaveLength(2500);
    // Must be 0,1000,2000 (step by rows returned) — NOT 0,2000,4000, which would
    // have silently skipped records 1000-1999.
    expect(offsets).toEqual([0, 1000, 2000]);
  });

  it("stops after a single request on a short, non-exceeded page", async () => {
    const fetchMock = vi.fn(async () => makeRes(feats(42), false));
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchArcgisPaged("https://arcgis.test/query", { where: "1=1" });
    expect(out).toHaveLength(42);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("breaks (no infinite loop) when a later page request fails", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      if (calls === 1) return makeRes(feats(2000), true);
      return { ok: false, json: async () => ({}) };
    }));
    const out = await fetchArcgisPaged("https://arcgis.test/query", {});
    expect(out).toHaveLength(2000); // first page kept; stops at the failed page
    expect(calls).toBe(2);
  });
});

describe("attachScores", () => {
  const row = (name: string, registered: number, turnout: number): PrecinctRow => ({
    name,
    municipality: "",
    registered,
    turnout,
    expected: Math.round(registered * (turnout / 100)),
    gotv: Math.round(registered * (1 - turnout / 100)),
  });
  const feat = (name?: string): GeoJSON.Feature => ({
    type: "Feature",
    properties: name != null ? { name, turnout: 20 } : {},
    geometry: { type: "Point", coordinates: [0, 0] },
  });

  it("stamps tier/play/rank/cumPct onto features by precinct name", () => {
    // Four equal precincts → cumulative shares 25/50/75/100 → tiers A/B/C/C
    // (cumulative-share tiering; a 2-row fixture would band everything C).
    const rows = ["P1", "P2", "P3", "P4"].map((n) => row(n, 1000, 30));
    const { scored } = scoreRows(rows, "votes");
    const [f1, f2] = attachScores([feat("P1"), feat("P2")], scored);
    const p1 = f1.properties as { tier?: string; rank?: number; play?: string; cumPct?: number };
    expect(p1.tier).toBe("A"); // first 25% of expected ballots → top tier
    expect(p1.rank).toBe(1);
    expect(p1.play).toBeTruthy();
    expect(p1.cumPct).toBe(25);
    expect((f2.properties as { tier?: string }).tier).toBe("B"); // cumulative 50%
    expect((f1.properties as { turnout?: number }).turnout).toBe(20); // existing props preserved
  });

  it("leaves unmatched / nameless features untouched (they paint as unscored, never a wrong tier)", () => {
    const { scored } = scoreRows([row("P1", 4000, 30)], "votes");
    const [unmatched, nameless] = attachScores([feat("NOPE"), feat()], scored);
    expect((unmatched.properties as { tier?: string }).tier).toBeUndefined();
    expect((nameless.properties as { tier?: string }).tier).toBeUndefined();
  });
});
