"use server";

import { prisma, dbConfigured } from "@/lib/db";

export type ContactResult = { ok: boolean; message: string };

export async function submitContact(_prev: ContactResult | null, formData: FormData): Promise<ContactResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const interests = formData.getAll("interests").map(String).join(", ");
  const message = String(formData.get("message") ?? "").trim();

  if (!name || (!email && !phone)) {
    return { ok: false, message: "Please add your name and an email or phone so we can reach you." };
  }

  if (!dbConfigured) {
    // No DB yet — don't pretend we saved it.
    return {
      ok: false,
      message: "Our intake isn't connected yet. Please email mattgrantforcongress@gmail.com and we'll follow up.",
    };
  }

  try {
    await prisma.volunteer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        city: city || null,
        interests: interests || null,
        notes: message || null,
        status: "NEW",
      },
    });
    return { ok: true, message: "Thank you! The campaign will be in touch soon. Onward to August 4." };
  } catch {
    return {
      ok: false,
      message: "Something went wrong saving your info. Please email mattgrantforcongress@gmail.com.",
    };
  }
}
