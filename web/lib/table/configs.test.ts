import { describe, it, expect } from "vitest";
import { applyQuery, emptyState } from "./query";
import { DONOR_TABLE, type DonorCtx } from "./donors-config";
import { TASK_TABLE } from "./tasks-config";
import { SUBSCRIBER_TABLE } from "./subscribers-config";
import { PRINT_TABLE } from "./print-config";
import { INFLUENCER_TABLE } from "./influencers-config";
import type { DonorRow, TaskRow } from "@/lib/queries";
import type { SubscriberRow } from "@/lib/subscribers";
import type { PrintItem } from "@/lib/data/printTracker";
import type { InfluencerRow } from "@/lib/influencers/airtable";
import type { TableConfig } from "./types";

const donor = (over: Partial<DonorRow>): DonorRow => ({
  id: "d", name: "D", email: "d@x.com", city: "Kirkwood", employer: "Acme", occupation: "Engineer",
  totalCents: 5000, thankedAt: null, ...over,
});
const task = (over: Partial<TaskRow>): TaskRow => ({
  id: "t", title: "Knock doors", detail: null, category: "Field", status: "TODO", priority: "MEDIUM",
  volunteerId: null, volunteerName: null, dueDate: null, ...over,
});

const withFacets = <R,>(cfg: typeof DONOR_TABLE | typeof TASK_TABLE, facets: Record<string, string[] | boolean>) =>
  ({ ...emptyState(cfg as never), facets });

describe("DONOR_TABLE facets", () => {
  const ctx: DonorCtx = { volunteerSet: new Set(["d@x.com"]), canSeeVolunteerFlag: true };
  const rows = [
    donor({ id: "ok" }),
    donor({ id: "missing", employer: null }),
    donor({ id: "over", totalCents: 400000 }),
    donor({ id: "thanked", thankedAt: "2026-06-01" }),
    donor({ id: "novol", email: "z@x.com" }),
  ];

  it("MISSING surfaces donors without employer/occupation", () => {
    const out = applyQuery(rows, DONOR_TABLE, withFacets(DONOR_TABLE, { fec: ["MISSING"] }), ctx);
    expect(out.map((r) => r.id)).toEqual(["missing"]);
  });
  it("over-limit flags contributions past the per-election cap", () => {
    const out = applyQuery(rows, DONOR_TABLE, withFacets(DONOR_TABLE, { over: true }), ctx);
    expect(out.map((r) => r.id)).toEqual(["over"]);
  });
  it("not-thanked excludes thanked donors", () => {
    const out = applyQuery(rows, DONOR_TABLE, withFacets(DONOR_TABLE, { thanks: ["NOT"] }), ctx);
    expect(out.some((r) => r.id === "thanked")).toBe(false);
  });
  it("also-a-volunteer matches the volunteer email set", () => {
    const out = applyQuery(rows, DONOR_TABLE, withFacets(DONOR_TABLE, { alsoVolunteer: true }), ctx);
    expect(out.every((r) => r.email === "d@x.com")).toBe(true);
    expect(out.some((r) => r.id === "novol")).toBe(false);
  });
});

describe("TASK_TABLE facets", () => {
  const rows = [
    task({ id: "a", priority: "HIGH", category: "Field", volunteerId: "v1" }),
    task({ id: "b", priority: "LOW", category: "Comms" }),
    task({ id: "c", priority: "MEDIUM", category: "Field" }),
  ];
  it("filters by category", () => {
    const out = applyQuery(rows, TASK_TABLE, withFacets(TASK_TABLE, { category: ["Field"] }), {});
    expect(out.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });
  it("filters unassigned tasks", () => {
    const out = applyQuery(rows, TASK_TABLE, withFacets(TASK_TABLE, { unassigned: true }), {});
    expect(out.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });
  it("default sort puts HIGH priority first", () => {
    const out = applyQuery(rows, TASK_TABLE, emptyState(TASK_TABLE), {});
    expect(out[0].priority).toBe("HIGH");
  });
});

describe("TASK_TABLE due facets/sort (ctx today = 2026-07-01)", () => {
  const ctx = { today: "2026-07-01" };
  const rows = [
    task({ id: "past", dueDate: "2026-06-28" }),
    task({ id: "today", dueDate: "2026-07-01" }),
    task({ id: "week", dueDate: "2026-07-05" }),
    task({ id: "far", dueDate: "2026-09-01" }),
    task({ id: "none", dueDate: null }),
  ];
  it("overdue facet catches only past-due", () => {
    expect(applyQuery(rows, TASK_TABLE, withFacets(TASK_TABLE, { overdue: true }), ctx).map((r) => r.id)).toEqual(["past"]);
  });
  it("due-today facet catches only today", () => {
    expect(applyQuery(rows, TASK_TABLE, withFacets(TASK_TABLE, { dueToday: true }), ctx).map((r) => r.id)).toEqual(["today"]);
  });
  it("due-this-week includes overdue + today + soon (not far/none)", () => {
    expect(applyQuery(rows, TASK_TABLE, withFacets(TASK_TABLE, { dueWeek: true }), ctx).map((r) => r.id).sort()).toEqual(["past", "today", "week"]);
  });
  it("due sort orders earliest-first, undated last", () => {
    const state = { ...emptyState(TASK_TABLE), sort: "due", dir: "asc" as const };
    expect(applyQuery(rows, TASK_TABLE, state, ctx).map((r) => r.id)).toEqual(["past", "today", "week", "far", "none"]);
  });
});

// ── Configs added with the shared <DataTable> ──

const sub = (over: Partial<SubscriberRow>): SubscriberRow => ({ email: "a@x.com", status: "subscribed", optOut: [], ...over });

describe("SUBSCRIBER_TABLE", () => {
  const rows = [
    sub({ email: "sub@x.com" }),
    sub({ email: "part@x.com", optOut: ["fundraising"] }),
    sub({ email: "gone@x.com", status: "unsubscribed" }),
    sub({ email: "bounce@x.com", status: "bounced" }),
  ];
  it("status facet filters to the selected statuses", () => {
    const out = applyQuery(rows, SUBSCRIBER_TABLE, { ...emptyState(SUBSCRIBER_TABLE), facets: { status: ["bounced"] } }, {});
    expect(out.map((r) => r.email)).toEqual(["bounce@x.com"]);
  });
  it("partial facet catches subscribed-with-opt-outs only", () => {
    const out = applyQuery(rows, SUBSCRIBER_TABLE, { ...emptyState(SUBSCRIBER_TABLE), facets: { partial: true } }, {});
    expect(out.map((r) => r.email)).toEqual(["part@x.com"]);
  });
  it("email search matches", () => {
    const out = applyQuery(rows, SUBSCRIBER_TABLE, { ...emptyState(SUBSCRIBER_TABLE), q: "gone" }, {});
    expect(out.map((r) => r.email)).toEqual(["gone@x.com"]);
  });
});

const item = (over: Partial<PrintItem>): PrintItem => ({
  item: "Flyer", category: "Flyers & handouts", template: "t.md", sheet_size: "8.5x11",
  disclaimer_required: "N", solicitation_tax_line: "N", internal_only: "N",
  quantity: "", vendor: "", unit_cost: "", order_by_date: "", in_hand_date: "", status: "Draft ready", ...over,
});

describe("PRINT_TABLE", () => {
  const rows = [
    item({ item: "A", disclaimer_required: "Y" }),
    item({ item: "B", status: "Planned" }),
    item({ item: "C", internal_only: "Y", category: "Administrative" }),
  ];
  it("flag facet matches the disclaimer flag", () => {
    const out = applyQuery(rows, PRINT_TABLE, { ...emptyState(PRINT_TABLE), facets: { flag: ["disclaimer"] } }, {});
    expect(out.map((r) => r.item)).toEqual(["A"]);
  });
  it("ready facet keeps only ready-to-print statuses", () => {
    const out = applyQuery(rows, PRINT_TABLE, { ...emptyState(PRINT_TABLE), facets: { ready: true } }, {});
    expect(out.map((r) => r.item).sort()).toEqual(["A", "C"]);
  });
});

const infl = (over: Partial<InfluencerRow>): InfluencerRow => ({
  id: "i", name: "N", title: "T", org: "O", segment: "Faith", stage: "Researched", influence: 3,
  outcome: "", alignment: "", owner: "", email: "", phone: "", url: "", nextAction: "", followUp: "", notes: "", ...over,
});

describe("INFLUENCER_TABLE", () => {
  const rows = [
    infl({ id: "hi", influence: 5 }),
    infl({ id: "lo", influence: 1, segment: "Business" }),
    infl({ id: "done", outcome: "Endorsed" }),
  ];
  it("segment facet filters", () => {
    const out = applyQuery(rows, INFLUENCER_TABLE, { ...emptyState(INFLUENCER_TABLE), facets: { segment: ["Business"] } }, {});
    expect(out.map((r) => r.id)).toEqual(["lo"]);
  });
  it("open facet excludes resolved outcomes", () => {
    const out = applyQuery(rows, INFLUENCER_TABLE, { ...emptyState(INFLUENCER_TABLE), facets: { open: true } }, {});
    expect(out.some((r) => r.id === "done")).toBe(false);
  });
  it("default sort is influence descending", () => {
    const out = applyQuery(rows, INFLUENCER_TABLE, emptyState(INFLUENCER_TABLE), {});
    expect(out[0].id).toBe("hi");
  });
});

describe("every config is structurally sound", () => {
  // Guard: presets/defaultSort reference real sort keys, facet+sort keys are unique.
  const configs: TableConfig<unknown>[] = [
    DONOR_TABLE, TASK_TABLE, SUBSCRIBER_TABLE, PRINT_TABLE, INFLUENCER_TABLE,
  ] as TableConfig<unknown>[];
  it.each(configs.map((c) => [c.id, c] as const))("%s: sort keys resolve and are unique", (_id, cfg) => {
    const sortKeys = cfg.sorts.map((s) => s.key);
    expect(new Set(sortKeys).size).toBe(sortKeys.length);
    expect(sortKeys).toContain(cfg.defaultSort.key);
    const facetKeys = cfg.facets.map((f) => f.key);
    expect(new Set(facetKeys).size).toBe(facetKeys.length);
    for (const p of cfg.presets ?? []) {
      if (p.state.sort) expect(sortKeys).toContain(p.state.sort);
    }
  });
});
