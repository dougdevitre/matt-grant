import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "@/lib/db";

// Chunked BatchWrite that retries UnprocessedItems. DynamoDB can return
// UnprocessedItems under throttling WITHOUT throwing, so code that ignores the
// response silently drops writes while reporting success. This loops on the
// unprocessed set with backoff until the table accepts everything (or gives up
// loudly after several attempts).
type PutReq = { PutRequest: { Item: Record<string, unknown> } };

export async function batchWritePut(items: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < items.length; i += 25) {
    let requests: PutReq[] = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    let attempt = 0;
    while (requests.length) {
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: requests } }));
      const unprocessed = res.UnprocessedItems?.[TABLE] ?? [];
      if (!unprocessed.length) break;
      if (++attempt > 5) {
        throw new Error(`batchWritePut: ${unprocessed.length} items still unprocessed after ${attempt} attempts`);
      }
      await new Promise((r) => setTimeout(r, Math.min(4000, 200 * 2 ** attempt)));
      requests = unprocessed as unknown as PutReq[];
    }
  }
}
