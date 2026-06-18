import { NextResponse } from "next/server";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";

export const runtime = "nodejs";

// Renders branded email templates for preview. ?key=<template> returns the HTML;
// no key returns an index. Public (marketing previews, no secrets).
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
