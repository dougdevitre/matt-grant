// Create the single DynamoDB table (PK/SK, on-demand billing). Idempotent.
//   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 npm run db:create-table
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE;
const region = process.env.AWS_REGION ?? "us-east-1";

async function main() {
  if (!TABLE) {
    console.error("Set DYNAMODB_TABLE (and AWS creds/region).");
    process.exit(1);
  }
  const client = new DynamoDBClient({ region });
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE }));
    console.log(`Table "${TABLE}" already exists.`);
    return;
  } catch {
    // not found — create it
  }
  await client.send(
    new CreateTableCommand({
      TableName: TABLE,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [
        { AttributeName: "PK", AttributeType: "S" },
        { AttributeName: "SK", AttributeType: "S" },
      ],
      KeySchema: [
        { AttributeName: "PK", KeyType: "HASH" },
        { AttributeName: "SK", KeyType: "RANGE" },
      ],
    }),
  );
  console.log(`Created table "${TABLE}" (PAY_PER_REQUEST) in ${region}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
