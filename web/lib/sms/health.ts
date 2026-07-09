// SMS go-live readiness for the admin console. Reports WHICH of the three Twilio
// secrets are present — never their values — so an admin can see exactly what's left
// to wire up. Distinct from smsEnabled() (lib/sms/send.ts), which collapses the same
// three secrets to a single boolean. Presence is the safe `!!(await getSecret(name))`
// coercion used elsewhere (lib/dashboardStatus.ts); the value never leaves getSecret.
import "server-only";
import { getSecret } from "@/lib/ssm";

export type SmsSecretKey = "TWILIO_ACCOUNT_SID" | "TWILIO_AUTH_TOKEN" | "TWILIO_MESSAGING_SERVICE_SID";

export type SmsSecretCheck = { key: SmsSecretKey; label: string; present: boolean };
export type SmsReadiness = {
  state: "live" | "setup"; // live = all three present; setup = at least one missing
  secrets: SmsSecretCheck[];
  presentCount: number;
  missing: string[]; // human labels of the missing secrets, for a one-line summary
};

const SMS_SECRETS: { key: SmsSecretKey; label: string }[] = [
  { key: "TWILIO_ACCOUNT_SID", label: "Account SID" },
  { key: "TWILIO_AUTH_TOKEN", label: "Auth token" },
  { key: "TWILIO_MESSAGING_SERVICE_SID", label: "Messaging Service SID" },
];

const present = async (key: SmsSecretKey): Promise<boolean> => {
  try {
    return !!(await getSecret(key));
  } catch {
    return false;
  }
};

/** Per-secret presence for the three Twilio credentials + a derived overall state. */
export async function smsReadiness(): Promise<SmsReadiness> {
  const secrets = await Promise.all(
    SMS_SECRETS.map(async (s) => ({ key: s.key, label: s.label, present: await present(s.key) })),
  );
  const presentCount = secrets.filter((s) => s.present).length;
  return {
    state: presentCount === SMS_SECRETS.length ? "live" : "setup",
    secrets,
    presentCount,
    missing: secrets.filter((s) => !s.present).map((s) => s.label),
  };
}
