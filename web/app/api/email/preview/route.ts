import { NextResponse } from "next/server";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";
import { getBroadcast } from "@/lib/email/broadcasts";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";

// Sample values for the per-recipient merge tokens the broadcast templates leave
// for the send layer (lib/email/send.ts fills these per recipient). The composer
// preview is not a real send, so we substitute readable samples so the iframe
// never shows a raw "{{unsubscribe_url}}".
const PREVIEW_TOKENS: Record<string, string> = {
  unsubscribe_url: "#unsubscribe",
  preferences_url: "#preferences",
  first_name: "Friend",
};
const MERGE_TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;
const fillPreviewTokens = (s: string) => s.replace(MERGE_TOKEN, (m, k) => (k in PREVIEW_TOKENS ? PREVIEW_TOKENS[k] : m));

// GET renders the static branded templates for marketing/QA previews. Public.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (key) {
    const t = EMAIL_TEMPLATES.find((x) => x.key === key);
    if (!t) return new NextResponse("Unknown template", { status: 404 });
    return new NextResponse(t.build().html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const rows = EMAIL_TEMPLATES.map(
    (t) => `<li style="margin:8px 0;"><span style="display:inline-block;width:120px;font-size:12px;color:#6B7280;text-transform:uppercase;">${t.kind}</span> <a href="?key=${t.key}" style="color:#2563EB;font-weight:bold;">${t.key}</a> — <em style="color:#374151;">${t.build().subject}</em></li>`,
  ).join("");
  const html = `<!doctype html><meta charset="utf-8"><title>Email previews — Matt Grant for Congress</title>
  <body style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;padding:32px 20px;color:#0F2540;">
  <h1 style="font-family:Georgia,serif;">Email previews</h1>
  <p style="color:#6B7280;">Branded transactional + broadcast templates. Click any to preview the full email.</p>
  <ul style="list-style:none;padding:0;">${rows}</ul></body>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

// POST renders ONE broadcast with the staff-entered variables, for the composer's
// live preview. Staff-gated (same permission as drafting a campaign). Returns the
// rendered subject + html + text with sample per-recipient personalization filled
// in — never sends anything.
export async function POST(req: Request) {
  const { role } = await staffGate();
  if (!can(role, "draftEmailCampaign")) return NextResponse.json({ error: "not allowed" }, { status: 403 });

  let body: { templateKey?: unknown; vars?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const broadcast = getBroadcast(typeof body.templateKey === "string" ? body.templateKey : "");
  if (!broadcast) return NextResponse.json({ error: "unknown template" }, { status: 404 });

  // Accept only the template's declared fields as strings — ignore anything else.
  const raw = (body.vars && typeof body.vars === "object" ? body.vars : {}) as Record<string, unknown>;
  const vars: Record<string, string> = {};
  for (const f of broadcast.fields) vars[f.name] = typeof raw[f.name] === "string" ? (raw[f.name] as string) : "";

  const email = broadcast.build(vars);
  return NextResponse.json({
    subject: fillPreviewTokens(email.subject),
    html: fillPreviewTokens(email.html),
    text: fillPreviewTokens(email.text),
  });
}
