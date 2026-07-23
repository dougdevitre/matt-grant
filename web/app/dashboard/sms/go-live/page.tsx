import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { GoLiveTestSend } from "@/components/dashboard/GoLiveTestSend";
import { SmsInsightsReadiness } from "@/components/dashboard/SmsInsightsReadiness";
import { smsReadiness } from "@/lib/sms/health";
import { smsInsightsReadiness } from "@/lib/reports/smsInsights";
import { smsEnabled } from "@/lib/sms/send";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const YES = "bg-field/15 text-field";
const NO = "bg-gold/20 text-ink";

// Admin-only "what's left to start texting" surface. Shows which of the three Twilio
// secrets are present (never their values), the external steps that live outside the
// app (webhook + cron), and a one-click test send. Mirrors the Setup & status page and
// the sms-go-live.md runbook.
export default async function SmsGoLivePage() {
  await requireCap("manageTeam");
  const [readiness, enabled, insights] = await Promise.all([smsReadiness(), smsEnabled(), smsInsightsReadiness()]);
  const webhookUrl = `${SITE_URL}/api/webhooks/twilio`;

  return (
    <>
      <PageHeader kicker="Admin" title="SMS go-live">
        <span className="rounded-sm bg-ink/5 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
          {readiness.presentCount}/{readiness.secrets.length} creds set
        </span>
      </PageHeader>
      <p className="mb-6 max-w-prose text-sm text-slate">
        Everything to send from the campaign number is built. What&rsquo;s left is external setup — the
        Twilio credentials, the inbound webhook, and the drain schedule. This page shows what&rsquo;s in
        place and lets you fire a test once the credentials land.
      </p>
      <HowTo
        steps={[
          "Load the three Twilio secrets into SSM (/matt-grant/*) — the badges below flip to “set” within ~5 minutes.",
          "In Twilio, finish Toll-Free Verification and point the inbound webhook at this app.",
          "Run infra/setup-aws.sh (from the repo root) to install the drain schedule.",
          "Opt your own number in (text the keyword to the campaign number), then send yourself a test below.",
          "Full runbook: web/docs/sms-go-live.md.",
        ]}
      />

      {/* 1 — Twilio credentials (per-secret presence, never values) */}
      <div className="card p-5">
        <p className="eyebrow text-brick">Twilio credentials (in SSM)</p>
        <div className="mt-3 divide-y divide-line">
          {readiness.secrets.map((s) => (
            <div key={s.key} className="flex items-center gap-3 py-2.5">
              <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${s.present ? YES : NO}`}>
                {s.present ? "Set" : "Missing"}
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">{s.label}</span>
              <span className="shrink-0 font-mono text-[0.65rem] text-slate">/matt-grant/{s.key}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate">
          {readiness.state === "live"
            ? "All three are set — texting is configured."
            : `Still needed: ${readiness.missing.join(", ")}. Store each as a SecureString SSM parameter.`}
        </p>
      </div>

      {/* 2 — External connections (config lives in Twilio / AWS, not the app) */}
      <div className="card mt-6 p-5">
        <p className="eyebrow text-brick">Connections (configured outside the app)</p>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="font-semibold text-ink">Inbound webhook</p>
            <p className="mt-0.5 text-xs text-slate">
              In the Twilio Messaging Service, set the inbound handler (HTTP POST) to:
            </p>
            <p className="mt-1 break-all rounded-sm border border-line bg-paper px-2.5 py-1.5 font-mono text-xs text-ink">{webhookUrl}</p>
          </div>
          <div>
            <p className="font-semibold text-ink">Drain schedule</p>
            <p className="mt-0.5 text-xs text-slate">
              Broadcasts queue and send in batches via the <span className="font-mono">matt-grant-sms-drain</span> EventBridge rule.
              Install it with <span className="font-mono">BASE_URL=… CRON_SECRET=… infra/setup-aws.sh</span> (from the repo root).
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Toll-Free Verification</p>
            <p className="mt-0.5 text-xs text-slate">
              Must show <span className="font-semibold">Verified</span> in Twilio, or carrier sends fail with error 30032 — nothing in the app can override this.
            </p>
          </div>
        </div>
      </div>

      {/* 2b — Insight-data readiness (drives the composer's priority presets) */}
      <SmsInsightsReadiness readiness={insights} />

      {/* 3 — One-click test send */}
      <div className="card mt-6 p-5">
        <p className="eyebrow text-brick">Send a test text</p>
        <p className="mt-1 text-xs text-slate">
          Fires one real text through the Messaging Service — the console equivalent of the runbook&rsquo;s curl smoke test.
        </p>
        {!enabled && (
          <p className="mt-2 text-xs text-slate">Add the three credentials above first — sending is disabled until Twilio is configured.</p>
        )}
        <GoLiveTestSend disabled={!enabled} />
      </div>

      <Link href="/dashboard/setup" className="mt-6 inline-block font-mono text-xs font-bold text-brick hover:underline">
        ← All integrations &amp; status
      </Link>
    </>
  );
}
