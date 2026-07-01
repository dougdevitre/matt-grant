import { describe, it, expect } from "vitest";
import { nextStep, buildChecklist, checklistProgress, type PersonalSignals } from "./personal";

const base: PersonalSignals = {
  role: "volunteer",
  isVolunteer: true,
  registeredToVote: true,
  hasDonated: true,
  captainName: "Sam",
  myTask: null,
  topAction: null,
  nextEvent: null,
  daysToPrimary: 30,
};
const sig = (over: Partial<PersonalSignals>): PersonalSignals => ({ ...base, ...over });

describe("nextStep — priority cascade", () => {
  it("registration comes first when not registered", () => {
    expect(nextStep(sig({ registeredToVote: false, hasDonated: false, captainName: null })).kind).toBe("register");
  });
  it("then a volunteer with no captain is told to join a team", () => {
    expect(nextStep(sig({ captainName: null, hasDonated: false })).kind).toBe("captain");
  });
  it("a non-volunteer with no captain is NOT pushed to join a team", () => {
    // supporter without a volunteer record skips the captain step
    const step = nextStep(sig({ role: "supporter", isVolunteer: false, captainName: null, hasDonated: true, nextEvent: null, topAction: null }));
    expect(step.kind).not.toBe("captain");
  });
  it("an overdue assigned task jumps ahead of joining a team", () => {
    const step = nextStep(sig({ captainName: null, myTask: { title: "Call sheet", href: "/dashboard/tasks", state: "overdue", label: "2 days overdue" } }));
    expect(step.kind).toBe("task");
    expect(step.title).toContain("overdue");
  });
  it("a task due today sits after the captain step but before events/actions", () => {
    const step = nextStep(sig({
      myTask: { title: "Door knock", href: "/dashboard/tasks", state: "today", label: "due today" },
      nextEvent: { title: "Rally", whenLabel: "Saturday", href: "/events/1" },
      topAction: { title: "Phone bank", href: "/community" },
    }));
    expect(step.kind).toBe("task");
    expect(step.title).toContain("Door knock");
  });
  it("a 'later' task does NOT preempt an event", () => {
    const step = nextStep(sig({
      myTask: { title: "Far task", href: "/dashboard/tasks", state: "later", label: "due Aug 1" },
      nextEvent: { title: "Rally", whenLabel: "Saturday", href: "/events/1" },
    }));
    expect(step.kind).toBe("event");
  });
  it("surfaces an upcoming event before a matched action", () => {
    const step = nextStep(sig({ nextEvent: { title: "Canvass launch", whenLabel: "Saturday", href: "/events/1" }, topAction: { title: "Phone bank", href: "/community" } }));
    expect(step.kind).toBe("event");
    expect(step.title).toContain("Canvass launch");
  });
  it("falls to a matched action when there's no event", () => {
    expect(nextStep(sig({ topAction: { title: "Phone bank", href: "/community" } })).kind).toBe("action");
  });
  it("asks non-donors to give once everything else is done", () => {
    expect(nextStep(sig({ hasDonated: false })).kind).toBe("donate");
  });
  it("role-tailors the all-set step", () => {
    expect(nextStep(sig({ role: "admin" })).href).toBe("/dashboard/team");
    expect(nextStep(sig({ role: "captain" })).href).toBe("/dashboard/playbook");
    expect(nextStep(sig({ role: "volunteer" })).kind).toBe("allset");
  });
  it("is deterministic", () => {
    const s = sig({ registeredToVote: false });
    expect(nextStep(s)).toEqual(nextStep(s));
  });
});

describe("buildChecklist", () => {
  it("members get all three items with real done-states", () => {
    const items = buildChecklist(sig({ registeredToVote: true, hasDonated: false, captainName: "Sam" }));
    expect(items.map((i) => i.key)).toEqual(["register", "donate", "captain"]);
    expect(items.find((i) => i.key === "register")!.done).toBe(true);
    expect(items.find((i) => i.key === "donate")!.done).toBe(false);
    expect(items.find((i) => i.key === "captain")!.done).toBe(true);
  });
  it("leaders (admin/captain) don't get the 'connect with a captain' item", () => {
    expect(buildChecklist(sig({ role: "admin" })).map((i) => i.key)).toEqual(["register", "donate"]);
    expect(buildChecklist(sig({ role: "captain" })).map((i) => i.key)).toEqual(["register", "donate"]);
  });
  it("captain CTA routes volunteers to join a team, non-volunteers to get involved", () => {
    const vol = buildChecklist(sig({ isVolunteer: true, captainName: null })).find((i) => i.key === "captain")!;
    expect(vol.cta.href).toBe("/community");
    const sup = buildChecklist(sig({ role: "supporter", isVolunteer: false, captainName: null })).find((i) => i.key === "captain")!;
    expect(sup.cta.href).toBe("/act");
  });
  it("progress counts completed items", () => {
    const items = buildChecklist(sig({ registeredToVote: true, hasDonated: true, captainName: null }));
    expect(checklistProgress(items)).toEqual({ done: 2, total: 3 });
  });
});
