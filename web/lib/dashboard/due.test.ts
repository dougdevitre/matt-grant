import { describe, it, expect } from "vitest";
import { classifyDue, cleanDate, dueSortKey, DUE_SOON_DAYS } from "./due";

const TODAY = "2026-07-01"; // a Wednesday

describe("cleanDate", () => {
  it("accepts YYYY-MM-DD and the date head of an ISO string", () => {
    expect(cleanDate("2026-07-04")).toBe("2026-07-04");
    expect(cleanDate("2026-07-04T13:00:00Z")).toBe("2026-07-04");
  });
  it("rejects junk and impossible months/days", () => {
    expect(cleanDate("nope")).toBeUndefined();
    expect(cleanDate("2026-13-01")).toBeUndefined();
    expect(cleanDate("2026-07-40")).toBeUndefined();
    expect(cleanDate(null)).toBeUndefined();
  });
});

describe("classifyDue", () => {
  it("none when undated", () => expect(classifyDue(null, TODAY).state).toBe("none"));
  it("overdue in the past, with a day count", () => {
    expect(classifyDue("2026-06-30", TODAY)).toEqual({ state: "overdue", label: "1 day overdue" });
    expect(classifyDue("2026-06-28", TODAY)).toEqual({ state: "overdue", label: "3 days overdue" });
  });
  it("today", () => expect(classifyDue(TODAY, TODAY)).toEqual({ state: "today", label: "due today" }));
  it("soon within the window (tomorrow + weekday)", () => {
    expect(classifyDue("2026-07-02", TODAY)).toEqual({ state: "soon", label: "due tomorrow" });
    expect(classifyDue("2026-07-04", TODAY).state).toBe("soon"); // Saturday, within 7 days
    expect(classifyDue("2026-07-04", TODAY).label).toMatch(/^due /);
  });
  it("later beyond the soon window", () => {
    const far = classifyDue("2026-08-01", TODAY);
    expect(far.state).toBe("later");
    expect(far.label).toMatch(/^due /);
  });
  it("the soon/later boundary is DUE_SOON_DAYS", () => {
    // exactly DUE_SOON_DAYS out = soon; one more = later
    const soonEdge = new Date(Date.parse(`${TODAY}T00:00:00Z`) + DUE_SOON_DAYS * 86400000).toISOString().slice(0, 10);
    const later = new Date(Date.parse(`${TODAY}T00:00:00Z`) + (DUE_SOON_DAYS + 1) * 86400000).toISOString().slice(0, 10);
    expect(classifyDue(soonEdge, TODAY).state).toBe("soon");
    expect(classifyDue(later, TODAY).state).toBe("later");
  });
});

describe("dueSortKey", () => {
  it("orders earliest-first and sinks undated to the end", () => {
    const rows = [{ d: null }, { d: "2026-07-10" }, { d: "2026-06-01" }];
    const sorted = [...rows].sort((a, b) => dueSortKey(a.d) - dueSortKey(b.d)).map((r) => r.d);
    expect(sorted).toEqual(["2026-06-01", "2026-07-10", null]);
  });
});
