import { describe, it, expect, vi, beforeEach } from "vitest";

// importDonors must be idempotent on re-submit: the bulk path now hands each row a
// deterministic externalId so recordContribution's atomic `seenIds` dedup collapses
// a duplicate import (double-click / retry / re-paste) instead of double-counting a
// donor's total — a doubled total can falsely trip the FEC over-limit flag.
const recordContribution = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: vi.fn(async () => ({ role: "admin", email: "a@x.test" })) }));
vi.mock("@/lib/rbac", () => ({ can: () => true }));
vi.mock("@/lib/db", () => ({ dbConfigured: true }));
vi.mock("@/lib/donors", () => ({ recordContribution: (c: unknown) => recordContribution(c), markThanked: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sesEnabled: false, sendEmail: vi.fn() }));
vi.mock("@/lib/email/donorThankYou", () => ({ donorThankYouEmail: () => ({ subject: "", html: "", text: "" }) }));

import { importDonors } from "./actions";

const fd = (csv: string) => {
  const f = new FormData();
  f.set("csv", csv);
  return f;
};
const externalIds = () => recordContribution.mock.calls.map((c) => (c[0] as { externalId: string }).externalId);

beforeEach(() => vi.clearAllMocks());

describe("importDonors idempotency", () => {
  const csv = "name,email,amount\nAlice,alice@x.com,3500\nBob,bob@x.com,100\n";

  it("assigns each row a stable externalId, identical across a re-import of the same CSV", async () => {
    await importDonors(null, fd(csv));
    const first = externalIds();
    expect(first).toHaveLength(2);
    expect(new Set(first).size).toBe(2); // distinct donors → distinct keys

    recordContribution.mockClear();
    await importDonors(null, fd(csv));
    const second = externalIds();
    // Same CSV → byte-identical externalIds, so recordContribution's seenIds dedup
    // no-ops the second import instead of appending Alice's $3,500 gift twice.
    expect(second).toEqual(first);
  });

  it("keeps two genuinely identical rows in one file as two distinct gifts (occurrence suffix)", async () => {
    await importDonors(null, fd("name,email,amount\nAlice,alice@x.com,3500\nAlice,alice@x.com,3500\n"));
    const ids = externalIds();
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]); // :0 and :1 — both counted
    expect(ids[0].endsWith(":0")).toBe(true);
    expect(ids[1].endsWith(":1")).toBe(true);
  });
});
