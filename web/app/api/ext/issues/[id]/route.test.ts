import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const setSubmissionStatus = vi.fn();
const updateSubmissionText = vi.fn();
const deleteSubmission = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/issue-board/airtable", () => ({
  setSubmissionStatus: (...a: unknown[]) => setSubmissionStatus(...a),
  updateSubmissionText: (...a: unknown[]) => updateSubmissionText(...a),
  deleteSubmission: (...a: unknown[]) => deleteSubmission(...a),
}));
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { PATCH, DELETE } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const params = Promise.resolve({ id: "rec_1" });
const patch = (body: unknown) =>
  new Request("http://test/api/ext/issues/rec_1", {
    method: "PATCH",
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const del = () => new Request("http://test/api/ext/issues/rec_1", { method: "DELETE", headers: { origin: EXT } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("PATCH /api/ext/issues/[id]", () => {
  it("403 without moderateIssues", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await PATCH(patch({ status: "Approved" }), { params });
    expect(res.status).toBe(403);
    expect(setSubmissionStatus).not.toHaveBeenCalled();
  });

  it("400 with an empty body", async () => {
    const res = await PATCH(patch({}), { params });
    expect(res.status).toBe(400);
  });

  it("routes a status change to setSubmissionStatus (issue.status)", async () => {
    const res = await PATCH(patch({ status: "Rejected" }), { params });
    expect(res.status).toBe(200);
    expect(setSubmissionStatus).toHaveBeenCalledWith("rec_1", "Rejected");
    expect(updateSubmissionText).not.toHaveBeenCalled();
    expect(recordExtAction).toHaveBeenCalledWith(expect.objectContaining({ action: "issue.status", target: "rec_1" }));
  });

  it("routes a text edit to updateSubmissionText (issue.text)", async () => {
    const res = await PATCH(patch({ topic: "Roads", details: "Fix potholes" }), { params });
    expect(res.status).toBe(200);
    expect(updateSubmissionText).toHaveBeenCalledWith("rec_1", { topic: "Roads", details: "Fix potholes" });
    expect(recordExtAction).toHaveBeenCalledWith(expect.objectContaining({ action: "issue.text" }));
  });

  it("maps an Airtable control-table denial → 403", async () => {
    setSubmissionStatus.mockRejectedValue(new Error("Editing submissions is disabled in Front-End Access."));
    const res = await PATCH(patch({ status: "Approved" }), { params });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/ext/issues/[id]", () => {
  it("deletes and audits", async () => {
    const res = await DELETE(del(), { params });
    expect(res.status).toBe(200);
    expect(deleteSubmission).toHaveBeenCalledWith("rec_1");
    expect(recordExtAction).toHaveBeenCalledWith(expect.objectContaining({ action: "issue.delete", target: "rec_1" }));
  });

  it("403 without moderateIssues", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await DELETE(del(), { params });
    expect(res.status).toBe(403);
    expect(deleteSubmission).not.toHaveBeenCalled();
  });
});
