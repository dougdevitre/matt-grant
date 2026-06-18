// Load illustrative sample data into the DynamoDB table.
//   DYNAMODB_TABLE=matt-grant AWS_REGION=us-east-1 npm run db:seed
// Illustrative only — not real donors, volunteers, or financials.
import { ddb, TABLE, PK } from "../lib/db";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

const now = new Date().toISOString();
const put = (Item: Record<string, unknown>) => ddb.send(new PutCommand({ TableName: TABLE, Item }));
let n = 0;
const uid = () => `seed-${++n}`;

async function main() {
  if (!TABLE) {
    console.error("Set DYNAMODB_TABLE.");
    process.exit(1);
  }

  // Donors (contributions nested)
  await put({ PK: PK.donors, SK: uid(), name: "Eleanor Voss", email: "evoss@example.com", city: "Kirkwood", employer: "Voss Architecture", occupation: "Architect", contributions: [{ amountCents: 250000, method: "WinRed", election: "PRIMARY", receivedAt: now }], createdAt: now });
  await put({ PK: PK.donors, SK: uid(), name: "Marcus Hale", email: "mhale@example.com", city: "Chesterfield", employer: "Self-employed", occupation: "Contractor", contributions: [{ amountCents: 100000, method: "WinRed", election: "PRIMARY", receivedAt: now }, { amountCents: 50000, method: "check", election: "PRIMARY", receivedAt: now }], createdAt: now });
  await put({ PK: PK.donors, SK: uid(), name: "Priya Anand", email: "panand@example.com", city: "Ballwin", employer: "BJC HealthCare", occupation: "Nurse", contributions: [{ amountCents: 35000, method: "WinRed", election: "PRIMARY", receivedAt: now }], createdAt: now });

  // Expenditures
  for (const e of [
    { payee: "Anedot / WinRed processing fees", amountCents: 8200, category: "Fundraising", memo: "Q2 platform fees" },
    { payee: "Lamar Outdoor — district billboard", amountCents: 120000, category: "Media", memo: "I-44 corridor, 4 weeks" },
    { payee: "Yard signs (1,000 units)", amountCents: 240000, category: "Field" },
    { payee: "NGP VAN / voter file access", amountCents: 75000, category: "Field", memo: "Cycle subscription" },
    { payee: "Compliance counsel — FEC review", amountCents: 90000, category: "Compliance" },
    { payee: "Event venue — Kirkwood town hall", amountCents: 45000, category: "Operations" },
  ]) await put({ PK: PK.expenditures, SK: uid(), ...e, paidAt: now });

  // Volunteers
  for (const v of [
    { name: "Dana Whitfield", city: "Webster Groves", interests: "canvass, events", status: "ACTIVE" },
    { name: "Tom Reyes", city: "Manchester", interests: "phones, data", status: "ACTIVE" },
    { name: "Sofia Klein", city: "Wildwood", interests: "signs, donate", status: "NEW" },
    { name: "Andre Boateng", city: "Ellisville", interests: "canvass", status: "NEW" },
  ]) await put({ PK: PK.volunteers, SK: uid(), ...v, createdAt: now });

  // Tasks
  for (const t of [
    { title: "File FEC Form 2 (Statement of Candidacy)", category: "Compliance", status: "DONE", priority: "HIGH" },
    { title: "Confirm ballot access — MO Secretary of State", category: "Compliance", status: "DONE", priority: "HIGH" },
    { title: "Lock weekly call-time blocks (10 hrs/wk)", category: "Finance", status: "DOING", priority: "HIGH" },
    { title: "Recruit 25 precinct captains", category: "Field", status: "DOING", priority: "HIGH" },
    { title: "Launch CHILD Protection Act explainer one-pager", category: "Comms", status: "TODO", priority: "MEDIUM" },
    { title: "Stand up texting platform + opt-in flow", category: "Ops", status: "TODO", priority: "MEDIUM" },
    { title: "Schedule 3 town halls across MO-02", category: "Field", status: "TODO", priority: "MEDIUM" },
  ]) await put({ PK: PK.tasks, SK: uid(), ...t, createdAt: now });

  // Milestones
  const m = (phase: string, title: string, target: string, done: boolean, sortOrder: number, detail?: string) =>
    put({ PK: PK.milestones, SK: uid(), phase, title, target, done, sortOrder, detail, createdAt: now });
  await m("Build", "Committee, treasurer & compliance live", "2026-03-01", true, 1);
  await m("Build", "Campaign plan + vote goal set", "2026-04-01", true, 2);
  await m("Fund", "Finance plan + call-time engine running", "2026-04-15", true, 3);
  await m("Fund", "First fundraising milestone", "2026-05-15", false, 4, "Illustrative target.");
  await m("Persuade", "Field program: precinct captains seated", "2026-06-01", false, 5);
  await m("Persuade", "Earned + paid media push begins", "2026-06-20", false, 6);
  await m("GOTV", "Absentee / early-vote chase begins", "2026-07-15", false, 7);
  await m("GOTV", "Election Day — MO-02 primary", "2026-08-04", false, 8, "Polls close; chase every supporter.");

  console.log("Seeded sample donors, expenditures, volunteers, tasks, milestones into", TABLE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
