"use server";

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";

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
    return {
      ok: false,
      message: "Our intake isn't connected yet. Please email mattgrantforcongress@gmail.com and we'll follow up.",
    };
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: PK.volunteers,
          SK: newId(),
          name,
          email: email || undefined,
          phone: phone || undefined,
          city: city || undefined,
          interests: interests || undefined,
          notes: message || undefined,
          status: "NEW",
          createdAt: new Date().toISOString(),
        },
      }),
    );
    return { ok: true, message: "Thank you! The campaign will be in touch soon. Onward to August 4." };
  } catch {
    return {
      ok: false,
      message: "Something went wrong saving your info. Please email mattgrantforcongress@gmail.com.",
    };
  }
}
