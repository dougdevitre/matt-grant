import { describe, it, expect } from "vitest";
import { applyQuery, emptyState } from "./query";
import { DONOR_TABLE, type DonorCtx } from "./donors-config";
import { TASK_TABLE } from "./tasks-config";
import type { DonorRow, TaskRow } from "@/lib/queries";

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
