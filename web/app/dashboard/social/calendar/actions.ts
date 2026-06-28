"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  createCalendarPost,
  updateCalendarPost,
  deleteCalendarPost,
  type PostPatch,
} from "@/lib/social/content-calendar";

export type CalendarResult = { ok: boolean; message: string };

// Two gates: Clerk RBAC (manageSocial) AND, inside the lib, the Airtable Front-End Access control
// table (Posts × dashboard CRUD) + the per-field Editable Fields allowlist.
async function guard(): Promise<CalendarResult | null> {
  const { role } = await staffGate();
  if (!can(role, "manageSocial")) return { ok: false, message: "Not allowed." };
  return null;
}

function readPatch(formData: FormData): PostPatch {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const ids = (k: string) => formData.getAll(k).map(String).filter(Boolean);
  return {
    title: get("title"),
    status: get("status"),
    channelIds: ids("channelIds"),
    pillarIds: ids("pillarIds"),
    campaignIds: ids("campaignIds"),
    publishDate: get("publishDate"),
    format: get("format"),
    hook: get("hook"),
    body: get("body"),
    cta: get("cta"),
    hashtags: get("hashtags"),
    approver: get("approver"),
    notes: get("notes"),
  };
}

export async function createPost(_prev: CalendarResult | null, formData: FormData): Promise<CalendarResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    await createCalendarPost(readPatch(formData));
    revalidatePath("/dashboard/social/calendar");
    return { ok: true, message: "Post added to the calendar." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Create failed." };
  }
}

export async function updatePost(_prev: CalendarResult | null, formData: FormData): Promise<CalendarResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing post id." };
  try {
    await updateCalendarPost(id, readPatch(formData));
    revalidatePath("/dashboard/social/calendar");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function removePost(_prev: CalendarResult | null, formData: FormData): Promise<CalendarResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing post id." };
  try {
    await deleteCalendarPost(id);
    revalidatePath("/dashboard/social/calendar");
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
}
