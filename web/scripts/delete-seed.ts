// Remove illustrative seed fixtures from a DynamoDB table.
//   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 npm run db:clean-seed        (dry run)
//   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 CONFIRM=1 npm run db:clean-seed   (delete)
//
// Dry run by default: prints exactly what it would delete and writes nothing.
// Set CONFIRM=1 to actually delete. This is a deliberate, manual operation — it is
// not wired into CI or the build. See scripts/seed-shared.ts for what counts as seed.
import { ddb, TABLE, PK } from "../lib/db";
import { QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SEED_PARTITIONS, SEED_SK_PREFIX, isSeedItem } from "./seed-shared";

type Row = Record<string, unknown> & { PK: string; SK: string };

// A short human label so the dry-run output is reviewable at a glance.
function label(item: Row): string {
  const v = item.name ?? item.title ?? item.payee;
  return typeof v === "string" ? v : "—";
}

async function queryPartition(pk: string): Promise<Row[]> {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": pk },
    }),
  );
  return (out.Items ?? []) as Row[];
}

async function main() {
  if (!TABLE) {
    console.error("Set DYNAMODB_TABLE.");
    process.exit(1);
  }

  const confirm = process.env.CONFIRM === "1";
  console.log(`Seed cleanup — table: ${TABLE} — mode: ${confirm ? "DELETE" : "DRY RUN"}\n`);

  // Collect every seed row across the seed partitions.
  const seedRows: Row[] = [];
  for (const pk of SEED_PARTITIONS) {
    const rows = (await queryPartition(pk)).filter(isSeedItem);
    console.log(`  ${pk.padEnd(12)} ${rows.length} seed record(s)`);
    for (const r of rows) console.log(`      ${r.SK}  ${label(r)}`);
    seedRows.push(...rows);
  }

  // Orphan check: real (non-seed) tasks that still point at a seed volunteerId. We
  // clear those references so no live task is left pointing at a deleted volunteer.
  const tasks = await queryPartition(PK.tasks);
  const orphanTasks = tasks.filter(
    (t) => !isSeedItem(t) && typeof t.volunteerId === "string" && t.volunteerId.startsWith(SEED_SK_PREFIX),
  );

  console.log(`\nTotal seed records: ${seedRows.length}`);
  console.log(`Live tasks referencing a seed volunteer (will be unassigned): ${orphanTasks.length}`);
  for (const t of orphanTasks) console.log(`      ${t.SK}  ${label(t)} -> ${String(t.volunteerId)}`);

  if (!confirm) {
    console.log("\nDry run — nothing deleted. Re-run with CONFIRM=1 to apply.");
    return;
  }

  // Apply: clear orphan references first, then delete the seed rows.
  for (const t of orphanTasks) {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.tasks, SK: t.SK },
        UpdateExpression: "SET volunteerId = :n, volunteerName = :n",
        ExpressionAttributeValues: { ":n": null },
      }),
    );
    console.log(`unassigned ${t.SK}`);
  }
  for (const r of seedRows) {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: r.PK, SK: r.SK } }));
    console.log(`deleted ${r.PK} ${r.SK}`);
  }

  console.log(`\nDone. Deleted ${seedRows.length} seed record(s); unassigned ${orphanTasks.length} task(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
