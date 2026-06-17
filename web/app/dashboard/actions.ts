"use server";

import { revalidatePath } from "next/cache";
import { prisma, dbConfigured } from "@/lib/db";

function requireDb() {
  if (!dbConfigured) throw new Error("Database not connected. Set DATABASE_URL.");
}

export async function addDonor(formData: FormData) {
  requireDb();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const amount = Number(formData.get("amount") ?? 0);
  const amountCents = Math.round((isFinite(amount) ? amount : 0) * 100);

  await prisma.donor.create({
    data: {
      name,
      email: String(formData.get("email") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      employer: String(formData.get("employer") ?? "").trim() || null,
      occupation: String(formData.get("occupation") ?? "").trim() || null,
      contributions:
        amountCents > 0
          ? { create: [{ amountCents, method: String(formData.get("method") ?? "WinRed") }] }
          : undefined,
    },
  });
  revalidatePath("/dashboard/donors");
  revalidatePath("/dashboard");
}

export async function addExpenditure(formData: FormData) {
  requireDb();
  const payee = String(formData.get("payee") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const amountCents = Math.round((isFinite(amount) ? amount : 0) * 100);
  if (!payee || amountCents <= 0) return;
  await prisma.expenditure.create({
    data: {
      payee,
      amountCents,
      category: String(formData.get("category") ?? "Operations"),
      memo: String(formData.get("memo") ?? "").trim() || null,
    },
  });
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function updateVolunteerStatus(formData: FormData) {
  requireDb();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "NEW" | "ACTIVE" | "INACTIVE";
  if (!id) return;
  await prisma.volunteer.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  requireDb();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await prisma.task.create({
    data: {
      title,
      category: String(formData.get("category") ?? "Field"),
      priority: (String(formData.get("priority") ?? "MEDIUM") as "LOW" | "MEDIUM" | "HIGH"),
    },
  });
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function setTaskStatus(formData: FormData) {
  requireDb();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as "TODO" | "DOING" | "DONE";
  if (!id) return;
  await prisma.task.update({ where: { id }, data: { status } });
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}
