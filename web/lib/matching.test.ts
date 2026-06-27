import { describe, it, expect } from "vitest";
import { taskInterests, scoreVolunteer, suggestVolunteers } from "@/lib/matching";
import type { TaskRow, VolunteerRow } from "@/lib/queries";

const task = (over: Partial<TaskRow> = {}): TaskRow => ({
  id: "t", title: "", detail: null, category: "Field", status: "TODO", priority: "MEDIUM",
  volunteerId: null, volunteerName: null, ...over,
});
const vol = (over: Partial<VolunteerRow> = {}): VolunteerRow => ({
  id: "v", name: "V", email: null, phone: null, city: null, interests: null, interestTags: [],
  notes: null, status: "ACTIVE", assignedTo: null, captainEmail: null, lastContactedAt: null, createdAt: "", ...over,
});

describe("taskInterests", () => {
  it("maps canvass keywords to Knock doors", () => {
    expect(taskInterests(task({ title: "Knock doors in precinct 3" }))).toContain("Knock doors");
  });
  it("maps phone/text keywords to Make calls", () => {
    expect(taskInterests(task({ title: "GOTV phone bank shift" }))).toContain("Make calls");
  });
});

describe("scoreVolunteer", () => {
  it("rewards an interest match", () => {
    const fit = scoreVolunteer(task({ title: "Canvass turf" }), vol({ interestTags: ["Knock doors"] }));
    expect(fit.score).toBeGreaterThan(50);
  });
  it("penalizes heavier load", () => {
    const light = scoreVolunteer(task({ title: "Canvass" }), vol({ interestTags: ["Knock doors"] }), 0);
    const heavy = scoreVolunteer(task({ title: "Canvass" }), vol({ interestTags: ["Knock doors"] }), 4);
    expect(heavy.score).toBeLessThan(light.score);
  });
  it("penalizes inactive volunteers", () => {
    expect(scoreVolunteer(task(), vol({ status: "INACTIVE" })).score).toBeLessThan(0);
  });
});

describe("suggestVolunteers", () => {
  it("ranks the best fit first and excludes non-matches", () => {
    const a = vol({ id: "a", name: "A", interestTags: ["Knock doors"], status: "ACTIVE" });
    const b = vol({ id: "b", name: "B", interestTags: ["Donate"], status: "NEW" });
    const out = suggestVolunteers(task({ title: "Knock doors" }), [b, a], {}, 3);
    expect(out[0].v.id).toBe("a");
    expect(out.find((s) => s.v.id === "b")).toBeUndefined();
  });
});
