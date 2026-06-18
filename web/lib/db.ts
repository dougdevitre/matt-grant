import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Single-table DynamoDB store. Credentials come from the default AWS chain
// (IAM role on Amplify/Lambda; AWS_* env or profile locally). The table name is
// the only required config; without it the app degrades to empty/demo state.

export const TABLE = process.env.DYNAMODB_TABLE ?? "";
export const dbConfigured = !!TABLE;

const globalForDdb = globalThis as unknown as { ddb?: DynamoDBDocumentClient };

export const ddb =
  globalForDdb.ddb ??
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }), {
    marshallOptions: { removeUndefinedValues: true },
  });

if (process.env.NODE_ENV !== "production") globalForDdb.ddb = ddb;

// Collection partition keys — each entity type lives in one partition so a
// Query by PK lists them all (fine at campaign scale).
export const PK = {
  donors: "DONOR",
  volunteers: "VOLUNTEER",
  tasks: "TASK",
  milestones: "MILESTONE",
  expenditures: "EXPENDITURE",
  legislators: "LEGISLATOR",
  votes: (bioguideId: string) => `VOTES#${bioguideId}`,
  bills: (bioguideId: string) => `BILLS#${bioguideId}`,
  ingestRuns: (target: string) => `INGESTRUN#${target}`,
} as const;

export function newId(): string {
  return crypto.randomUUID();
}
