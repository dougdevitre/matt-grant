// SMS broadcast templates + helpers. Parallels lib/email/broadcasts.ts but much
// simpler: a short body, no rich text. build() returns the raw body; the composer
// and the campaign creator wrap it with withCompliance() before counting/sending.
import { CAMPAIGN } from "@/lib/site";

export type SmsField = { name: string; label: string; placeholder?: string };
export type SmsTemplateDef = {
  key: string;
  label: string;
  description: string;
  fields: SmsField[];
  build: (vars: Record<string, string>) => string;
};

// FEC "Paid for by" disclaimer (11 CFR 110.11) + TCPA opt-out, appended to every
// broadcast. A mass political text is a public communication, so it carries the full
// authorized-committee disclaimer — the same standard as every sample in
// messaging/sms-texting.md — reusing the single source of truth (CAMPAIGN.paidForBy
// already ends with a period).
export const SMS_COMPLIANCE_SUFFIX = ` — ${CAMPAIGN.paidForBy} Reply STOP to opt out.`;

export function withCompliance(body: string): string {
  const b = body.trim();
  return b ? `${b}${SMS_COMPLIANCE_SUFFIX}` : "";
}

// GSM-7 charset (basic + the 9 extended chars that cost 2 septets). Used to pick
// the encoding and count segments the way carriers bill them.
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_EXT = new Set("^{}\\[~]|€");

export type SegmentInfo = { chars: number; segments: number; encoding: "GSM-7" | "UCS-2" };

export function smsSegments(text: string): SegmentInfo {
  let units = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.has(ch)) units += 1;
    else if (GSM_EXT.has(ch)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153);
    return { chars: units, segments, encoding: "GSM-7" };
  }
  const u = text.length; // UTF-16 code units, as carriers count UCS-2
  const segments = u === 0 ? 0 : u <= 70 ? 1 : Math.ceil(u / 67);
  return { chars: u, segments, encoding: "UCS-2" };
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

export const SMS_TEMPLATES: SmsTemplateDef[] = [
  {
    key: "reminder",
    label: "Event reminder",
    description: "Nudge supporters about an upcoming event.",
    fields: [
      { name: "what", label: "What", placeholder: "Town hall" },
      { name: "when", label: "When", placeholder: "Sat 10am" },
      { name: "where", label: "Where", placeholder: "Chesterfield" },
    ],
    build: (v) => tidy(`Reminder: ${v.what || "our campaign event"} ${v.when || ""}${v.where ? ` at ${v.where}` : ""}. Hope to see you there!`),
  },
  {
    key: "gotv",
    label: "GOTV reminder",
    description: "Get-out-the-vote push for the Aug 4 primary.",
    fields: [{ name: "days", label: "Days until the primary", placeholder: "3" }],
    build: (v) => tidy(`The August 4 primary is ${v.days ? `${v.days} days away` : "almost here"}. Make your plan to vote — every vote counts.`),
  },
  {
    key: "custom",
    label: "Custom message",
    description: "Write your own short message.",
    fields: [{ name: "body", label: "Message", placeholder: "Your message" }],
    build: (v) => tidy(v.body || ""),
  },
];

export const getSmsTemplate = (key: string): SmsTemplateDef | undefined => SMS_TEMPLATES.find((t) => t.key === key);

export const SMS_TEMPLATE_META = SMS_TEMPLATES.map(({ key, label, description, fields }) => ({ key, label, description, fields }));
