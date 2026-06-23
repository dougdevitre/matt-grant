import { NextResponse, type NextRequest } from "next/server";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getDonors, getVolunteers } from "@/lib/queries";
import { toCsv } from "@/lib/contacts/import";

// Download a contact list as CSV. Capability-gated per type (the link is also
// only rendered for authorized roles, but a crafted GET must be re-checked here):
//   donors → viewDonorDetail (admin)   ·   volunteers → manageVolunteers
// Auth rides on the Clerk session cookie, so a plain <a download> works.
export const dynamic = "force-dynamic";

function csvResponse(csv: string, filename: string) {
  // Lead with a UTF-8 BOM so Excel opens it as UTF-8 (accented names, etc.).
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const { role } = await staffGate();
  const today = new Date().toISOString().slice(0, 10);

  if (type === "donors") {
    if (!can(role, "viewDonorDetail")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { rows } = await getDonors();
    const csv = toCsv(
      ["name", "email", "city", "employer", "occupation", "total"],
      rows.map((d) => [d.name, d.email, d.city, d.employer, d.occupation, (d.totalCents / 100).toFixed(2)]),
    );
    return csvResponse(csv, `donors-${today}.csv`);
  }

  if (type === "volunteers") {
    if (!can(role, "manageVolunteers")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { rows } = await getVolunteers();
    const csv = toCsv(
      ["name", "email", "phone", "city", "interests", "status", "assignedTo", "lastContactedAt", "createdAt"],
      rows.map((v) => [v.name, v.email, v.phone, v.city, v.interests, v.status, v.assignedTo, v.lastContactedAt, v.createdAt]),
    );
    return csvResponse(csv, `volunteers-${today}.csv`);
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
}
