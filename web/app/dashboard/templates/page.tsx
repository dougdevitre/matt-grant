import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { TemplateManager } from "@/components/dashboard/TemplateManager";
import { requireCap } from "@/lib/auth";
import { listSavedTemplates } from "@/lib/notifications/messageTemplates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireCap("draftEmailCampaign");
  const templates = await listSavedTemplates();

  return (
    <>
      <PageHeader kicker="Comms" title="Message templates" />

      <HowTo
        steps={[
          "Save reusable email or SMS copy, each tagged with a default audience role.",
          "In the Email or Text composer, pick a saved template to prefill the copy and pre-select its role.",
          "Email templates use the branded announcement layout; SMS templates are a plain message (compliance suffix added automatically).",
          "Editing a template here doesn't change anything already sent — it's a starting point for the next send.",
        ]}
      />

      <TemplateManager templates={templates} />
    </>
  );
}
