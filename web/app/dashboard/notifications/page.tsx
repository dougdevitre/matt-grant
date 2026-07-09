import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { NotificationPrefs } from "@/components/dashboard/NotificationPrefs";
import { TextAlertsPrefs } from "@/components/dashboard/TextAlertsPrefs";
import { requireCap } from "@/lib/auth";
import { notificationTypesForRole } from "@/lib/notifications/types";
import { getMutedNotifications } from "@/lib/notifications/prefs";
import { getMyStoredPhone } from "@/lib/clerkRoles";
import { consentStatus } from "@/lib/sms/consent";
import { smsEnabled } from "@/lib/sms/send";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  // Any staffer may manage their OWN notification preferences (viewOverview = all staff).
  const gate = await requireCap("viewOverview");
  const [types, muted, myPhone, live] = await Promise.all([
    notificationTypesForRole(gate.role),
    gate.email ? getMutedNotifications(gate.email) : Promise.resolve([]),
    getMyStoredPhone(),
    smsEnabled(),
  ]);
  const optedIn = myPhone ? (await consentStatus(myPhone)) === "opted_in" : false;

  return (
    <>
      <PageHeader kicker="Settings" title="My notifications" />

      <HowTo
        steps={[
          "These are the automated alerts the campaign sends YOU based on your role.",
          "Uncheck anything you'd rather not be emailed about — it only affects your inbox.",
          "Defaults: you're subscribed to everything relevant to your role.",
        ]}
      />

      <NotificationPrefs types={types} muted={muted} />

      <TextAlertsPrefs phone={myPhone ?? ""} optedIn={optedIn} notLive={!live} />
    </>
  );
}
