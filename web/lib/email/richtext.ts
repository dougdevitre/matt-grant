// Safe rich-text for staff-authored email fields. Staff write a small, familiar
// markdown subset (paragraphs, line breaks, **bold**, *italic*, [links](url), and
// - bullet lists); we convert it to inline-styled, email-safe HTML. Everything is
// HTML-escaped FIRST, so no staff input can inject markup or script — the only
// tags in the output are the ones this module emits. Used by the broadcast
// templates (lib/email/broadcasts.ts) instead of dropping raw input into markup.

const SANS = "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const LINK = "#1F5FCb";

// Escape the five HTML-significant characters. Safe for both element text and
// double-quoted attribute values.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Allow only safe link/href schemes; anything else (javascript:, data:, …) is
// neutralized to "#". Accepts http(s), mailto, tel, in-page (#) and site-relative
// (/) URLs. Input may already be HTML-escaped (e.g. "&amp;" in a query string).
export function safeUrl(u: string): string {
  const t = u.trim();
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  if (/^[#/]/.test(t)) return t;
  return "#";
}

// Apply inline formatting to an ALREADY-ESCAPED line: [label](url), **bold**,
// *italic* / _italic_. Order matters — links first so emphasis inside a label
// still renders, and so `*` inside a URL isn't mistaken for emphasis.
function inline(escaped: string): string {
  let s = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeHtml(safeUrl(url))}" target="_blank" style="color:${LINK};text-decoration:underline;">${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
  return s;
}

/**
 * Convert a staff-authored markdown-lite string into email-safe HTML: blank-line
 * separated paragraphs, single newlines as <br>, "- "/"* " bullet lists, plus
 * inline bold/italic/links. Returns "" for empty input (callers leave the
 * template token in place so an empty optional field shows nothing).
 */
export function richToEmailHtml(input: string): string {
  const text = (input ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
    if (isList) {
      const items = lines
        .map((l) => `<li style="margin:0 0 6px;">${inline(escapeHtml(l.replace(/^\s*[-*]\s+/, "")))}</li>`)
        .join("");
      out.push(`<ul style="margin:0 0 16px;padding-left:22px;font-family:${SANS};">${items}</ul>`);
    } else {
      const html = lines.map((l) => inline(escapeHtml(l))).join("<br>");
      out.push(`<p style="margin:0 0 16px;">${html}</p>`);
    }
  }
  return out.join("\n");
}

// Flatten the same markdown-lite syntax to plain text for the multipart text/plain
// alternative: drop emphasis markers, render [label](url) as "label (url)", keep
// bullets and line breaks.
export function richToText(input: string): string {
  return (input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => `${label} (${url})`)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?]|$)/g, "$1$2")
    .trim();
}
