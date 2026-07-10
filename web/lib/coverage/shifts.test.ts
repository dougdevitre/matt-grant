import { describe, expect, it } from "vitest";
import { nonGsmChars } from "@/lib/sms/templates";
import {
  buildShiftMatrix,
  myUpcomingShifts,
  openShifts,
  reminderBody,
  remindersFor,
  coverageGrid,
  datesInRange,
  DEFAULT_EARLY_WINDOWS,
  DEFAULT_ELECTION_DAY_WINDOWS,
  ELECTION_DAY,
  fillStats,
  filterNewShifts,
  MATRIX_MAX_DAYS,
  rawToShift,
  sanitizeShift,
  shiftDedupeKey,
  shiftPackets,
  shiftStatus,
  windowRank,
  type ShiftInput,
  type ShiftRecord,
} from "./shifts";

const input = (over: Partial<ShiftInput> = {}): ShiftInput => ({
  site: "Daniel Boone Library",
  date: "2026-07-21",
  window: "Open–noon",
  needed: 1,
  assignees: [],
  ...over,
});

const rec = (over: Partial<ShiftRecord> = {}): ShiftRecord => ({
  ...input(),
  id: "s1",
  createdAt: "",
  updatedAt: "",
  updatedBy: "admin@x.com",
  reminded: [],
  ...over,
});

describe("shiftDedupeKey / filterNewShifts", () => {
  it("keys on lowercased site + date + lowercased window", () => {
    expect(shiftDedupeKey(input())).toBe("daniel boone library|2026-07-21|open–noon");
    expect(shiftDedupeKey(input({ site: "  DANIEL BOONE LIBRARY " }))).toBe(shiftDedupeKey(input()));
  });

  it("drops rows already saved and self-duplicates within a batch", () => {
    const existing = [input()];
    const incoming = [input(), input({ window: "Noon–close" }), input({ window: "NOON–CLOSE" })];
    const fresh = filterNewShifts(existing, incoming);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].window).toBe("Noon–close");
  });
});

describe("sanitizeShift", () => {
  it("rejects rows missing site, a real date, or a window", () => {
    expect(sanitizeShift(null)).toBeNull();
    expect(sanitizeShift({ date: "2026-07-21", window: "x" })).toBeNull();
    expect(sanitizeShift({ site: "A", date: "07/21/2026", window: "x" })).toBeNull();
    expect(sanitizeShift({ site: "A", date: "2026-07-21", window: "  " })).toBeNull();
  });

  it("clamps needed to 1–10 and defaults to 1", () => {
    expect(sanitizeShift(input({ needed: 0 }))?.needed).toBe(1);
    expect(sanitizeShift(input({ needed: 99 }))?.needed).toBe(10);
    expect(sanitizeShift({ site: "A", date: "2026-07-21", window: "x", needed: "3" })?.needed).toBe(1);
  });

  it("keeps only well-formed assignees, deduped by id", () => {
    const raw = input({
      assignees: [
        { id: "v1", name: "Ann" },
        { id: "v1", name: "Ann again" },
        { id: "", name: "no id" },
        { name: "no id at all" },
        "garbage",
      ] as never,
    });
    expect(sanitizeShift(raw)?.assignees).toEqual([{ id: "v1", name: "Ann" }]);
  });
});

describe("rawToShift", () => {
  it("maps SK to id and re-sanitizes the payload", () => {
    const r = rawToShift({ SK: "abc", ...input(), needed: 42, updatedBy: "a@x.com" });
    expect(r?.id).toBe("abc");
    expect(r?.needed).toBe(10);
    expect(r?.updatedBy).toBe("a@x.com");
  });

  it("returns null without an id or a valid payload", () => {
    expect(rawToShift({ ...input() })).toBeNull();
    expect(rawToShift({ SK: "abc", site: "A" })).toBeNull();
  });
});

describe("datesInRange / buildShiftMatrix", () => {
  it("returns the inclusive range and caps runaway spans", () => {
    expect(datesInRange("2026-07-21", "2026-07-23")).toEqual(["2026-07-21", "2026-07-22", "2026-07-23"]);
    expect(datesInRange("2026-08-04", "2026-08-04")).toEqual(["2026-08-04"]);
    expect(datesInRange("2026-08-04", "2026-07-21")).toEqual([]);
    expect(datesInRange("bad", "2026-07-21")).toEqual([]);
    expect(datesInRange("2020-01-01", "2026-01-01")).toHaveLength(MATRIX_MAX_DAYS);
  });

  it("builds sites × days × windows, swapping in Election-Day windows on Aug 4", () => {
    const dates = datesInRange("2026-08-03", ELECTION_DAY);
    const rows = buildShiftMatrix([{ site: "A" }, { site: "B", county: "Jefferson" }], dates);
    // 2 sites × (1 early day × 2 windows + Election Day × 3 windows) = 10
    expect(rows).toHaveLength(10);
    const aug4 = rows.filter((r) => r.date === ELECTION_DAY);
    expect(aug4.map((r) => r.window)).toEqual([
      ...DEFAULT_ELECTION_DAY_WINDOWS,
      ...DEFAULT_ELECTION_DAY_WINDOWS,
    ]);
    const early = rows.filter((r) => r.date !== ELECTION_DAY);
    expect(new Set(early.map((r) => r.window))).toEqual(new Set(DEFAULT_EARLY_WINDOWS));
    expect(rows.every((r) => r.needed === 1 && r.assignees.length === 0)).toBe(true);
    expect(rows.find((r) => r.site === "B")?.county).toBe("Jefferson");
  });
});

describe("shiftStatus / windowRank", () => {
  it("reports covered / partial / uncovered against needed", () => {
    expect(shiftStatus({ needed: 1, assignees: [] })).toBe("uncovered");
    expect(shiftStatus({ needed: 2, assignees: [{ id: "a", name: "A" }] })).toBe("partial");
    expect(shiftStatus({ needed: 1, assignees: [{ id: "a", name: "A" }] })).toBe("covered");
  });

  it("orders the default window labels chronologically", () => {
    expect(windowRank("Open–noon")).toBeLessThan(windowRank("Noon–close"));
    expect(windowRank("6–9 AM")).toBeLessThan(windowRank("9 AM–4 PM"));
    expect(windowRank("9 AM–4 PM")).toBeLessThan(windowRank("4–7 PM"));
    expect(windowRank("mystery label")).toBe(24);
  });
});

describe("coverageGrid / fillStats", () => {
  const shifts = [
    rec({ id: "1", site: "B site", date: "2026-07-22", window: "Noon–close" }),
    rec({ id: "2", site: "B site", date: "2026-07-22", window: "Open–noon", assignees: [{ id: "v1", name: "Ann" }] }),
    rec({ id: "3", site: "A site", date: "2026-07-21", window: "Open–noon", assignees: [{ id: "v1", name: "Ann" }] }),
    rec({ id: "4", site: "A site", date: "2026-07-21", window: "Noon–close", assignees: [{ id: "v2", name: "Bo" }] }),
  ];

  it("groups site → date → window, sorted, with per-day coverage", () => {
    const grid = coverageGrid(shifts);
    expect(grid.map((g) => g.site)).toEqual(["A site", "B site"]);
    const a = grid[0].days[0];
    expect(a.shifts.map((s) => s.window)).toEqual(["Open–noon", "Noon–close"]);
    expect(a.fullyCovered).toBe(true);
    expect(grid[1].days[0].fullyCovered).toBe(false);
  });

  it("computes the §8 fill metrics", () => {
    const stats = fillStats(shifts);
    expect(stats).toMatchObject({ total: 4, covered: 3, partial: 0, uncovered: 1, fillPct: 75 });
    expect(stats.days).toEqual([
      { date: "2026-07-21", sites: 1, sitesFullyCovered: 1 },
      { date: "2026-07-22", sites: 1, sitesFullyCovered: 0 },
    ]);
  });

  it("handles the empty board", () => {
    expect(coverageGrid([])).toEqual([]);
    expect(fillStats([]).fillPct).toBe(0);
  });
});

describe("rawToShift reminded bookkeeping", () => {
  it("maps a stored Set or array to string[] and defaults to []", () => {
    expect(rawToShift({ SK: "a", ...input(), reminded: new Set(["v1", "v2"]) })?.reminded).toEqual(["v1", "v2"]);
    expect(rawToShift({ SK: "a", ...input(), reminded: ["v1", 7, ""] })?.reminded).toEqual(["v1"]);
    expect(rawToShift({ SK: "a", ...input() })?.reminded).toEqual([]);
  });
});

describe("remindersFor", () => {
  // Realistic roster ids: the volunteer SK is `e:<email>` for email signups (the
  // common case), `p:<digits>` phone-only, or a uuid — never a raw email. The
  // original suite used bare "v1" ids and missed that `includes("@")` misrouted
  // every email-keyed volunteer into the captain bucket (never texted).
  const ann = { id: "e:ann@x.com", name: "Ann" };
  const bo = { id: "p:3145550100", name: "Bo" };
  const cap = { id: "cap@x.com", name: "Cap" };
  const shifts = [
    rec({ id: "1", date: "2026-07-22", window: "Noon–close", assignees: [ann, cap] }),
    rec({ id: "2", date: "2026-07-22", window: "Open–noon", site: "Other Site", assignees: [ann, bo], reminded: [bo.id] }),
    rec({ id: "3", date: "2026-07-23", assignees: [bo] }),
  ];

  it("groups one target per volunteer for the date, windows in day order, excluding already-reminded", () => {
    const r = remindersFor(shifts, "2026-07-22");
    expect(r.volunteers.map((t) => t.assignee.name)).toEqual(["Ann"]); // Bo already reminded on 2, not on this date otherwise
    expect(r.volunteers[0].shifts.map((s) => s.id)).toEqual(["2", "1"]); // Open–noon before Noon–close
    // Email id → captain bucket, same target shape (their shifts ride along).
    expect(r.captains.map((t) => t.assignee.id)).toEqual(["cap@x.com"]);
    expect(r.captains[0].shifts.map((s) => s.id)).toEqual(["1"]);
  });

  it("routes ids by shape: raw email = captain; e:/p:/uuid = volunteer", () => {
    const uuid = { id: "8f2c1c1e-0000-4000-8000-000000000000", name: "Cy" };
    const r = remindersFor([rec({ id: "7", date: "2026-07-30", assignees: [ann, bo, cap, uuid] })], "2026-07-30");
    expect(r.volunteers.map((t) => t.assignee.id).sort()).toEqual([uuid.id, ann.id, bo.id].sort());
    expect(r.captains.map((t) => t.assignee.id)).toEqual([cap.id]);
  });

  it("applies the reminded-exclusion to captains too", () => {
    const r = remindersFor([rec({ id: "9", date: "2026-07-25", assignees: [cap], reminded: [cap.id] })], "2026-07-25");
    expect(r.captains).toEqual([]);
  });

  it("returns empty for a date with no assigned shifts", () => {
    expect(remindersFor(shifts, "2026-08-01")).toEqual({ volunteers: [], captains: [] });
  });
});

describe("reminderBody", () => {
  it("covers every shift that day and stays GSM-7 clean despite en-dash labels", () => {
    const body = reminderBody("Ann", [
      { site: "Daniel Boone Library", window: "Open–noon" },
      { site: "Site “B”", window: "6–9 AM" },
    ], "2026-08-04");
    expect(body).toContain("Tue, Aug 4");
    expect(body).toContain("Daniel Boone Library (Open-noon), then Site \"B\" (6-9 AM)");
    expect(body).toContain("25+ ft");
    expect(nonGsmChars(body)).toEqual([]);
  });

  it("falls back when the first name is blank", () => {
    expect(reminderBody("", [{ site: "A", window: "W" }], "2026-07-21")).toContain("Hi there,");
  });
});

describe("openShifts / myUpcomingShifts", () => {
  const me = { id: "e:me@x.com", name: "Me" };
  const other = { id: "e:other@x.com", name: "Other" };
  const shifts = [
    rec({ id: "past", date: "2026-07-20" }), // before fromDate — never shown
    rec({ id: "full", date: "2026-07-22", assignees: [other] }), // needed 1, full
    rec({ id: "open-late", date: "2026-07-23", window: "Noon–close" }),
    rec({ id: "open-early", date: "2026-07-23", window: "Open–noon" }),
    rec({ id: "mine-open", date: "2026-07-25", needed: 2, assignees: [me] }), // open, but I'm on it
    rec({ id: "mine-past", date: "2026-07-01", assignees: [me] }),
  ];

  it("lists upcoming under-filled shifts chronologically, excluding the viewer's own", () => {
    expect(openShifts(shifts, "2026-07-21", me.id).map((s) => s.id)).toEqual(["open-early", "open-late"]);
    // Without an exclusion, a still-open shift the viewer is on shows up.
    expect(openShifts(shifts, "2026-07-21").map((s) => s.id)).toEqual(["open-early", "open-late", "mine-open"]);
  });

  it("lists only the viewer's upcoming shifts", () => {
    expect(myUpcomingShifts(shifts, me.id, "2026-07-21").map((s) => s.id)).toEqual(["mine-open"]);
    expect(myUpcomingShifts(shifts, "e:nobody@x.com", "2026-07-21")).toEqual([]);
  });
});

describe("shiftPackets", () => {
  it("groups chronologically per assignee and lists every under-filled shift", () => {
    const shifts = [
      rec({ id: "1", date: "2026-07-22", assignees: [{ id: "v1", name: "Ann" }] }),
      rec({ id: "2", date: "2026-07-21", needed: 2, assignees: [{ id: "v1", name: "Ann" }, { id: "v2", name: "Bo" }] }),
      rec({ id: "3", date: "2026-08-04", window: "6–9 AM" }),
    ];
    const { packets, unfilled } = shiftPackets(shifts);
    expect(packets.map((p) => p.name)).toEqual(["Ann", "Bo"]);
    expect(packets[0].shifts.map((s) => s.id)).toEqual(["2", "1"]);
    expect(packets[1].shifts.map((s) => s.id)).toEqual(["2"]);
    expect(unfilled.map((s) => s.id)).toEqual(["3"]);
  });
});
