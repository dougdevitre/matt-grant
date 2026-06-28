import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { NotificationPrefs } from "@/components/dashboard/NotificationPrefs";
import { requireCap } from "@/lib/auth";
import { notificationTypesForRole } from "@/lib/notifications/types";
import { getMutedNotifications } from "@/lib/notifications/prefs";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  // Any staffer may manage their OWN notification preferences (viewOverview = all staff).
  const gate = await requireCap("viewOverview");
  const types = notificationTypesForRole(gate.role);
  const muted = gate.email ? await getMutedNotifications(gate.email) : [];

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
    </>
  );
}
