import { describe, it, expect, vi, beforeEach } from "vitest";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const send = vi.fn();
vi.mock("@/lib/db", () => ({
  ddb: { send: (...a: unknown[]) => send(...a) },
  TABLE: "t",
  PK: { tasks: "TASK" },
  newId: () => "task_123",
}));

import { createTask, setTaskStatus } from "./tasks";

beforeEach(() => vi.clearAllMocks());

describe("createTask", () => {
  it("puts a TODO task and returns the new id", async () => {
    const id = await createTask({ title: "Knock doors", detail: "turf 4" });
    expect(id).toBe("task_123");
    const cmd = send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item).toMatchObject({
      PK: "TASK",
      SK: "task_123",
      title: "Knock doors",
      detail: "turf 4",
      category: "Field",
      priority: "MEDIUM",
      status: "TODO",
    });
  });

  it("defaults category/priority and omits dueDate when absent", async () => {
    await createTask({ title: "X" });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.category).toBe("Field");
    expect(item.priority).toBe("MEDIUM");
    expect("dueDate" in item).toBe(false);
  });

  it("includes a provided dueDate", async () => {
    await createTask({ title: "X", dueDate: "2026-07-10" });
    expect(send.mock.calls[0][0].input.Item.dueDate).toBe("2026-07-10");
  });
});

describe("setTaskStatus", () => {
  it("updates only the status field for the given id, guarded to existing tasks", async () => {
    send.mockResolvedValueOnce({});
    const ok = await setTaskStatus("task_9", "DONE");
    expect(ok).toBe(true);
    const cmd = send.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(UpdateCommand);
    expect(cmd.input.Key).toEqual({ PK: "TASK", SK: "task_9" });
    expect(cmd.input.ExpressionAttributeValues).toEqual({ ":s": "DONE" });
    // Guard: never upsert a phantom task from a non-existent id.
    expect(cmd.input.ConditionExpression).toBe("attribute_exists(SK)");
  });

  it("returns false (no throw) when the task does not exist", async () => {
    send.mockRejectedValueOnce(Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" }));
    expect(await setTaskStatus("ghost", "DONE")).toBe(false);
  });
});
