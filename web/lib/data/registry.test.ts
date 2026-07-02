import { describe, it, expect } from "vitest";
import { SOURCES, SOURCES_BY_KIND, KIND_LABEL } from "./registry";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import { GOVERNANCE } from "@/lib/airtable/governance-manifest";

// Cross-registry drift guard. The data hub's SOURCES[] is supposed to be "every
// data source in the app", but it lived independently of the integration clients
// and the Airtable registry — so a new datastore (Airtable) or a new upstream
// (OpenStates) could ship without ever appearing on the hub. These assertions
// tie the inventories together: if you add an Airtable base or an integration
// client and forget the hub row, a check goes red instead of silently drifting.

const byId = (id: string) => SOURCES.find((s) => s.id === id);

describe("data hub ↔ Airtable registry", () => {
  it("every Airtable base has a matching hub source (airtable-<key>)", () => {
    for (const key of Object.keys(AIRTABLE_BASES)) {
      const entry = byId(`airtable-${key}`);
      expect(entry, `SOURCES missing airtable-${key} — add it in lib/data/registry.ts`).toBeTruthy();
      expect(entry!.kind).toBe("airtable");
    }
  });

  it("each Airtable source points at its per-base health route and is checkable", () => {
    for (const key of Object.keys(AIRTABLE_BASES)) {
      const entry = byId(`airtable-${key}`)!;
      expect(entry.endpoint).toBe(`/api/airtable/health/${key}`);
      expect(entry.checkable).toBe(true);
      expect(entry.enabledEnv).toContain("AIRTABLE_API_KEY");
    }
  });

  it("every governed Airtable base is represented on the hub", () => {
    for (const g of GOVERNANCE) {
      expect(byId(`airtable-${g.base}`), `governed base ${g.base} not on the hub`).toBeTruthy();
    }
  });
});

describe("data hub ↔ integration clients", () => {
  // Each live integration client under lib/integrations/** must surface as a hub
  // source. The value is the SOURCES id it maps to (some share a route — e.g. the
  // legislative store is surfaced as the CHILD Act read). This is the check that
  // would have caught OpenStates being absent.
  const EXPECTED_CLIENT_SOURCES: Record<string, string> = {
    fec: "fec",
    census: "census",
    congress: "congress",
    news: "news",
    wikipedia: "wikipedia",
    openstates: "openstates",
    legislative: "child-act",
  };

  it("every integration client has a hub source", () => {
    for (const [client, id] of Object.entries(EXPECTED_CLIENT_SOURCES)) {
      expect(byId(id), `integration client "${client}" has no SOURCES entry "${id}"`).toBeTruthy();
    }
  });
});

describe("kind maps stay exhaustive", () => {
  it("SOURCES_BY_KIND and KIND_LABEL cover exactly the same kinds", () => {
    expect(Object.keys(SOURCES_BY_KIND).sort()).toEqual(Object.keys(KIND_LABEL).sort());
  });

  it("every source's kind has a label and a group", () => {
    for (const s of SOURCES) {
      expect(KIND_LABEL[s.kind], `no KIND_LABEL for kind "${s.kind}"`).toBeTruthy();
      expect(SOURCES_BY_KIND[s.kind], `no SOURCES_BY_KIND group for "${s.kind}"`).toContain(s);
    }
  });

  it("has no duplicate source ids", () => {
    const ids = SOURCES.map((s) => s.id);
    expect(new Set(ids).size, "duplicate source id in SOURCES").toBe(ids.length);
  });
});
