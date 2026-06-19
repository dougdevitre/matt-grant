"use server";

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { volunteerWelcome } from "@/lib/email/templates";

export type CommitResult = { ok: boolean; message: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A supporter commits to a specific issue + how they'll help. Captured as a
// volunteer lead tagged with the issue (shows in the dashboard CRM; an admin/
// captain can then mobilize that segment via the "issues" email topic), and sent
// the branded welcome. Best-effort email; never blocks the commitment.
export async function commitToIssue(_prev: CommitResult | null, formData: FormData): Promise<CommitResult> {
  // Honeypot: bots fill this hidden field.
  if (String(formData.get("company") ?? "").trim()) return { ok: true, message: "You're in — thank you." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const issueLabel = String(formData.get("issueLabel") ?? "this issue").trim();
  const ways = formData.getAll("ways").map(String).filter(Boolean);

  if (!name || !email) return { ok: false, message: "Add your name and email so the campaign can follow up." };
  if (!email.includes("@")) return { ok: false, message: "Please enter a valid email address." };
  if (!dbConfigured) {
    return { ok: false, message: "Our intake isn't connected yet — email mattgrantforcongress@gmail.com and we'll follow up." };
  }

  const interests = `${issueLabel}${ways.length ? " — " + ways.join(", ") : ""}`;
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: PK.volunteers,
          SK: newId(),
          name,
          email,
          interests,
          notes: `Committed on the “${issueLabel}” issue page.`,
          status: "NEW",
          source: "issue-commit",
          createdAt: new Date().toISOString(),
        },
      }),
    );
  } catch {
    return { ok: false, message: "Something went wrong saving your commitment. Please try again." };
  }

  if (sesEnabled && email) {
    try {
      const tpl = volunteerWelcome(esc(name.split(" ")[0] || "there"));
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      /* lead saved even if the welcome email fails */
    }
  }

  return { ok: true, message: `You're in — thank you for standing with Matt on ${issueLabel}.` };
}
