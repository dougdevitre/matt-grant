"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { sendMessengerReply } from "@/lib/messenger/send";
import { blockSender, unblockSender, parseKey } from "@/lib/messenger/conversations";

export type MsgrActionState = { ok: boolean; message: string };

async function gate(): Promise<{ email: string | null } | null> {
  const g = await staffGate();
  return g.ok && can(g.role, "messageIndividuals") ? { email: g.email } : null;
}

function refresh(key: string) {
  revalidatePath("/dashboard/messages/social");
  revalidatePath(`/dashboard/messages/social/${encodeURIComponent(key)}`);
}

/** Reply within a Messenger / Instagram thread (human-initiated only). */
export async function replyMessengerMessage(formData: FormData): Promise<MsgrActionState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const key = String(formData.get("key") ?? "");
  const parsed = parseKey(key);
  if (!parsed) return { ok: false, message: "Bad conversation id." };
  const r = await sendMessengerReply({ platform: parsed.platform, psid: parsed.psid, text: String(formData.get("body") ?? ""), by: g.email ?? "system" });
  if (!r.sent) return { ok: false, message: r.reason ?? "Couldn't send." };
  refresh(key);
  return { ok: true, message: "Sent." };
}

export async function blockSenderAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const key = String(formData.get("key") ?? "");
  if (!parseKey(key)) return;
  await blockSender({ key, by: g.email ?? "system" });
  refresh(key);
}

export async function unblockSenderAction(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const key = String(formData.get("key") ?? "");
  if (!parseKey(key)) return;
  await unblockSender(key);
  refresh(key);
}
