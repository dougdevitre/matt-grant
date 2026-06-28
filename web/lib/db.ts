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
  fecDetail: "FECDETAIL", // outside money (Sched E) + spending breakdown (Sched B)
  wikiBio: "WIKIBIO", // candidate Wikipedia bio enrichment
  news: "NEWS", // candidate recent-coverage feed (Google News RSS)
  printOrders: "PRINTORDER", // submitted print-order dedupe keys (idempotency)
  rateLimit: "RATELIMIT", // fixed-window rate-limit counters (auto-expire via TTL)
  stateLeg: (slug: string) => `STATELEG#${slug}`,
  timeline: (slug: string) => `TIMELINE#${slug}`,
  statements: (slug: string) => `STMT#${slug}`,
  profile: "PROFILE", // supporter involvement profile (issues, ways-to-help, zip)
  assets: "ASSET", // asset-library metadata (tags, uploader, original size) keyed by S3 key
  onboarding: "ONBOARDING", // per-user "dismissed the Start-here guide" flag, SK = email
  smsCampaigns: "SMSCAMPAIGN", // queued SMS broadcasts (drained like email campaigns)
  smsConvos: "SMSCONVO", // 1:1 conversation index (one row per person; SK = E.164)
  smsThread: (e164: string) => `SMSTHREAD#${e164}`, // per-person message thread (SK = `${iso}#${id}`)
  smsBlocks: "SMSBLOCK", // blocked/banned numbers (SK = E.164; inbound dropped, outbound refused)
  inviteReminders: "INVITEREMINDER", // per-email reminder bookkeeping (SK = email; remindedAt, count)
  events: "EVENT", // campaign events/appearances (SK = `${startISO}#${id}`; chronological)
  eventIngest: "EVENTINGEST", // inbound-email → event dedupe keys (idempotency, SK = sha256)
  eventRsvps: "EVENTRSVP", // RSVPs for Airtable-sourced events (no DynamoDB item; SK = `${eventId}#${id}`)
  districtInsights: "DISTRICTINSIGHT", // cached per-district demographics + AI blurb (SK = districtKey)
  gameScores: "GAMESCORE", // arcade leaderboard (anon; SK = `${gameId}#${paddedScore}#${id}`, no PII)
  notifPrefs: "NOTIFPREF", // per-staffer notification opt-outs (SK = email; muted: string[])
  msgTemplates: "MSGTEMPLATE", // admin-saved role-tagged email/SMS templates (SK = id)
} as const;

export function newId(): string {
  return crypto.randomUUID();
}
