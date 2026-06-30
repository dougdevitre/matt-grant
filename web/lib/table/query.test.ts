import { describe, it, expect } from "vitest";
import { applyQuery, tokenize, stateToParams, paramsToState, emptyState, activeFilterCount } from "./query";
import type { TableConfig, QueryState } from "./types";

type Row = { name: string; city: string; status: string; tags: string[]; n: number };

const rows: Row[] = [
  { name: "Dana Ray", city: "Kirkwood", status: "ACTIVE", tags: ["calls"], n: 3 },
  { name: "Lee Park", city: "St. Louis", status: "NEW", tags: ["doors", "calls"], n: 1 },
  { name: "Sam Cole", city: "Kirkwood", status: "ACTIVE", tags: ["doors"], n: 2 },
];

const cfg: TableConfig<Row> = {
  id: "test",
  search: (r) => `${r.name} ${r.city}`,
  facets: [
    { key: "status", label: "Status", type: "select", match: (r, sel) => (sel as string[]).includes(r.status) },
    { key: "tag", label: "Tag", type: "multi", match: (r, sel) => (sel as string[]).some((t) => r.tags.includes(t)) },
    { key: "active", label: "Active only", type: "boolean", match: (r) => r.status === "ACTIVE" },
    { key: "secret", label: "Gated", type: "boolean", show: (ctx) => ctx.admin === true, match: () => false },
  ],
  sorts: [
    { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    { key: "n", label: "Count", compare: (a, b) => a.n - b.n },
  ],
  defaultSort: { key: "name", dir: "asc" },
};

const st = (over: Partial<QueryState> = {}): QueryState => ({ ...emptyState(cfg), ...over });

describe("tokenize", () => {
  it("splits terms and keeps quoted phrases", () => {
    expect(tokenize('dana "st louis" calls')).toEqual(["dana", "st louis", "calls"]);
  });
});

describe("applyQuery", () => {
  it("search matches across configured fields, all terms required (AND)", () => {
    expect(applyQuery(rows, cfg, st({ q: "kirkwood" })).map((r) => r.name)).toEqual(["Dana Ray", "Sam Cole"]);
    expect(applyQuery(rows, cfg, st({ q: "dana kirkwood" })).map((r) => r.name)).toEqual(["Dana Ray"]);
  });

  it("select facet filters; multi facet is OR within the facet", () => {
    expect(applyQuery(rows, cfg, st({ facets: { status: ["NEW"] } })).map((r) => r.name)).toEqual(["Lee Park"]);
    expect(applyQuery(rows, cfg, st({ facets: { tag: ["doors", "calls"] } })).length).toBe(3);
  });

  it("facets combine with AND across facets", () => {
    const out = applyQuery(rows, cfg, st({ facets: { status: ["ACTIVE"], tag: ["doors"] } }));
    expect(out.map((r) => r.name)).toEqual(["Sam Cole"]);
  });

  it("boolean facet only filters when ON", () => {
    expect(applyQuery(rows, cfg, st({ facets: { active: false } })).length).toBe(3);
    expect(applyQuery(rows, cfg, st({ facets: { active: true } })).length).toBe(2);
  });

  it("hidden (un-shown) facet is ignored even if selected", () => {
    // secret matches nothing, but show() is false without ctx.admin → must not filter
    expect(applyQuery(rows, cfg, st({ facets: { secret: true } }), {}).length).toBe(3);
    expect(applyQuery(rows, cfg, st({ facets: { secret: true } }), { admin: true }).length).toBe(0);
  });

  it("sorts ascending and respects desc", () => {
    expect(applyQuery(rows, cfg, st({ sort: "n", dir: "asc" })).map((r) => r.n)).toEqual([1, 2, 3]);
    expect(applyQuery(rows, cfg, st({ sort: "n", dir: "desc" })).map((r) => r.n)).toEqual([3, 2, 1]);
  });
});

describe("URL round-trip", () => {
  it("encodes only non-defaults and decodes back", () => {
    const state = st({ q: "dana", facets: { status: ["ACTIVE"], tag: ["doors", "calls"], active: true }, sort: "n", dir: "desc" });
    const params = stateToParams(cfg, state);
    expect(params.get("q")).toBe("dana");
    expect(params.get("f.status")).toBe("ACTIVE");
    expect(params.get("f.tag")).toBe("doors,calls");
    expect(params.get("f.active")).toBe("1");
    expect(params.get("sort")).toBe("n");
    expect(params.get("dir")).toBe("desc");
    const back = paramsToState(cfg, params);
    expect(back).toEqual(state);
  });

  it("default state encodes to nothing", () => {
    expect(stateToParams(cfg, emptyState(cfg)).toString()).toBe("");
  });

  it("ignores an unknown sort key, keeping the default", () => {
    const back = paramsToState(cfg, new URLSearchParams("sort=bogus"));
    expect(back.sort).toBe("name");
  });
});

describe("activeFilterCount", () => {
  it("counts search + each active facet", () => {
    expect(activeFilterCount(cfg, st({ q: "x", facets: { status: ["NEW"], active: true } }))).toBe(3);
    expect(activeFilterCount(cfg, st())).toBe(0);
  });
});
