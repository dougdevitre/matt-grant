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

// Reuse the client across warm Lambda invocations (and dev hot-reloads). The AWS
// SDK client is safe to share; building a fresh one per cold module-eval in
// production wasted connection setup for no benefit. Cache in ALL environments.
globalForDdb.ddb = ddb;

// Collection partition keys — each entity type lives in one partition so a
// Query by PK lists them all (fine at campaign scale).
export const PK = {
  donors: "DONOR",
  volunteers: "VOLUNTEER",
  tasks: "TASK",
  milestones: "MILESTONE",
  expenditures: "EXPENDITURE",
  staff: "STAFF",
  legislators: "LEGISLATOR",
  votes: (bioguideId: string) => `VOTES#${bioguideId}`,
  bills: (bioguideId: string) => `BILLS#${bioguideId}`,
  ingestRuns: (target: string) => `INGESTRUN#${target}`,
  // Multi-candidate field engine (opposition / alignment research).
  candidates: "CANDIDATE",
  fec: "FEC",
  fecDonors: "FECDONORS",
  printOrders: "PRINTORDER", // submitted print-order dedupe keys (idempotency)
  stateLeg: (slug: string) => `STATELEG#${slug}`,
  timeline: (slug: string) => `TIMELINE#${slug}`,
  statements: (slug: string) => `STMT#${slug}`,
} as const;

export function newId(): string {
  return crypto.randomUUID();
}
