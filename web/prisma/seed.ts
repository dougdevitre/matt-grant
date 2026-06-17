import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Illustrative seed data ONLY — not real donors, volunteers, or financials.
// Replace with live campaign data once the DB is connected.

async function main() {
  const donors = await Promise.all([
    prisma.donor.create({
      data: {
        name: "Eleanor Voss",
        email: "evoss@example.com",
        city: "Kirkwood",
        employer: "Voss Architecture",
        occupation: "Architect",
        contributions: {
          create: [{ amountCents: 250000, method: "WinRed" }],
        },
      },
    }),
    prisma.donor.create({
      data: {
        name: "Marcus Hale",
        email: "mhale@example.com",
        city: "Chesterfield",
        employer: "Self-employed",
        occupation: "Contractor",
        contributions: {
          create: [
            { amountCents: 100000, method: "WinRed" },
            { amountCents: 50000, method: "check" },
          ],
        },
      },
    }),
    prisma.donor.create({
      data: {
        name: "Priya Anand",
        email: "panand@example.com",
        city: "Ballwin",
        employer: "BJC HealthCare",
        occupation: "Nurse",
        contributions: { create: [{ amountCents: 35000, method: "WinRed" }] },
      },
    }),
  ]);

  await prisma.volunteer.createMany({
    data: [
      { name: "Dana Whitfield", city: "Webster Groves", interests: "canvass, events", status: "ACTIVE" },
      { name: "Tom Reyes", city: "Manchester", interests: "phones, data", status: "ACTIVE" },
      { name: "Sofia Klein", city: "Wildwood", interests: "signs, donate", status: "NEW" },
      { name: "Andre Boateng", city: "Ellisville", interests: "canvass", status: "NEW" },
    ],
  });

  await prisma.task.createMany({
    data: [
      { title: "File FEC Form 2 (Statement of Candidacy)", category: "Compliance", status: "DONE", priority: "HIGH" },
      { title: "Confirm ballot access — MO Secretary of State", category: "Compliance", status: "DONE", priority: "HIGH" },
      { title: "Lock weekly call-time blocks (10 hrs/wk)", category: "Finance", status: "DOING", priority: "HIGH" },
      { title: "Recruit 25 precinct captains", category: "Field", status: "DOING", priority: "HIGH" },
      { title: "Launch CHILD Protection Act explainer one-pager", category: "Comms", status: "TODO", priority: "MEDIUM" },
      { title: "Stand up texting platform + opt-in flow", category: "Ops", status: "TODO", priority: "MEDIUM" },
      { title: "Schedule 3 town halls across MO-02", category: "Field", status: "TODO", priority: "MEDIUM" },
    ],
  });

  await prisma.expenditure.createMany({
    data: [
      { payee: "Anedot / WinRed processing fees", amountCents: 8200, category: "Fundraising", memo: "Q2 platform fees" },
      { payee: "Lamar Outdoor — district billboard", amountCents: 120000, category: "Media", memo: "I-44 corridor, 4 weeks" },
      { payee: "Yard signs (1,000 units)", amountCents: 240000, category: "Field" },
      { payee: "NGP VAN / voter file access", amountCents: 75000, category: "Field", memo: "Cycle subscription" },
      { payee: "Compliance counsel — FEC review", amountCents: 90000, category: "Compliance" },
      { payee: "Event venue — Kirkwood town hall", amountCents: 45000, category: "Operations" },
    ],
  });

  const m = (phase: string, title: string, target: string, done: boolean, sortOrder: number, detail?: string) => ({
    phase, title, target: new Date(target), done, sortOrder, detail: detail ?? null,
  });

  await prisma.milestone.createMany({
    data: [
      m("Build", "Committee, treasurer & compliance live", "2026-03-01", true, 1),
      m("Build", "Campaign plan + vote goal set", "2026-04-01", true, 2),
      m("Fund", "Finance plan + call-time engine running", "2026-04-15", true, 3),
      m("Fund", "First fundraising milestone", "2026-05-15", false, 4, "Illustrative target — see strategic plan."),
      m("Persuade", "Field program: precinct captains seated", "2026-06-01", false, 5),
      m("Persuade", "Earned + paid media push begins", "2026-06-20", false, 6),
      m("GOTV", "Absentee / early-vote chase begins", "2026-07-15", false, 7),
      m("GOTV", "Election Day — MO-02 primary", "2026-08-04", false, 8, "Polls close; chase every supporter."),
    ],
  });

  console.log(`Seeded ${donors.length} donors, 6 expenditures, 4 volunteers, 7 tasks, 8 milestones.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
