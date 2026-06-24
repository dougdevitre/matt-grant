// Pulls readable plaintext out of a raw MIME email and out of an SES inbound
// notification. SES (with the SNS receipt action) hands us the full raw message,
// base64-encoded, plus parsed commonHeaders. We use the headers for from/subject
// and MIME-parse the body for the text the AI parser reads. This is deliberately
// pragmatic, not a spec-complete MIME implementation: the downstream LLM tolerates
// imperfect input, so we cover the cases real email actually uses (multipart/
// alternative, base64 + quoted-printable transfer encodings, an HTML fallback).

export type InboundEmail = { from: string; subject: string; text: string };

function splitHeadersBody(raw: string): { head: string; body: string } {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m || m.index === undefined) return { head: raw, body: "" };
  return { head: raw.slice(0, m.index), body: raw.slice(m.index + m[0].length) };
}

function parseHeaders(head: string): Record<string, string> {
  // Unfold RFC 5322 continuation lines (a header wrapped onto an indented line).
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");
  const out: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

function getBoundary(contentType: string): string | null {
  const m = contentType.match(/boundary="?([^";]+)"?/i);
  return m ? m[1].trim() : null;
}

function decodeQuotedPrintable(s: string): string {
  const bytes = s
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // QP yields raw bytes; reinterpret as UTF-8.
  try {
    return Buffer.from(bytes, "latin1").toString("utf8");
  } catch {
    return bytes;
  }
}

function decodeTransfer(body: string, cte: string): string {
  const e = cte.toLowerCase();
  if (e.includes("base64")) {
    try {
      return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      return body;
    }
  }
  if (e.includes("quoted-printable")) return decodeQuotedPrintable(body);
  return body;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParts(body: string, boundary: string): string[] {
  const delim = `--${boundary}`;
  const segments = body.split(delim);
  const parts: string[] = [];
  // segments[0] is the preamble; the closing delimiter is "--boundary--".
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startsWith("--")) break; // closing boundary → done
    parts.push(seg.replace(/^\r?\n/, "")); // drop the CRLF right after the boundary line
  }
  return parts;
}

/** Best-effort plaintext from a raw MIME message (recurses into multipart). */
export function extractTextFromMime(raw: string): string {
  const { head, body } = splitHeadersBody(raw);
  const headers = parseHeaders(head);
  const ct = (headers["content-type"] || "text/plain").toLowerCase();
  const cte = headers["content-transfer-encoding"] || "7bit";

  if (ct.startsWith("multipart/")) {
    const boundary = getBoundary(headers["content-type"] || "");
    if (!boundary) return "";
    let plain = "";
    let html = "";
    for (const part of splitParts(body, boundary)) {
      const ph = parseHeaders(splitHeadersBody(part).head);
      const pct = (ph["content-type"] || "text/plain").toLowerCase();
      const t = extractTextFromMime(part);
      if (!t) continue;
      if (pct.startsWith("text/html")) html ||= t;
      else plain ||= t; // text/plain, nested multipart, or untyped default
    }
    return plain || html || "";
  }

  const decoded = decodeTransfer(body, cte);
  return ct.startsWith("text/html") ? htmlToText(decoded) : decoded.trim();
}

/** Map an SES "Received" notification (the parsed SNS Message) to from/subject/text. */
export function parseSesNotification(message: Record<string, unknown>): InboundEmail | null {
  const mail = message.mail as Record<string, unknown> | undefined;
  if (!mail) return null;
  const common = (mail.commonHeaders as Record<string, unknown>) || {};
  const from = Array.isArray(common.from) && common.from.length ? String(common.from[0]) : String(mail.source ?? "");
  const subject = typeof common.subject === "string" ? common.subject : "";

  let text = "";
  const content = message.content;
  if (typeof content === "string" && content.trim()) {
    // SES's SNS action base64-encodes the raw message by default. Decode only when
    // it actually looks like base64 (raw MIME has ":" and "<" which aren't in the
    // base64 alphabet), so a raw-MIME content also works.
    const compact = content.replace(/\s+/g, "");
    const looksB64 = /^[A-Za-z0-9+/=]+$/.test(compact) && compact.length % 4 === 0;
    const raw = looksB64 ? Buffer.from(content, "base64").toString("utf8") : content;
    text = extractTextFromMime(raw);
  }
  return { from, subject, text };
}
