import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { ContentCalendar } from "@/components/dashboard/ContentCalendar";
import { requireCap } from "@/lib/auth";
import {
  socialConfigured,
  calendarWritable,
  listCalendarPosts,
  listChannels,
  listPillars,
  listCampaigns,
} from "@/lib/social/content-calendar";

export const dynamic = "force-dynamic";

export default async function ContentCalendarPage() {
  await requireCap("manageSocial");

  const configured = await socialConfigured();
  const [posts, channels, pillars, campaigns, editable] = configured
    ? await Promise.all([
        listCalendarPosts(),
        listChannels(),
        listPillars(),
        listCampaigns(),
        calendarWritable(),
      ])
    : [[], [], [], [], false];

  return (
    <>
      <PageHeader kicker="Comms" title="Content calendar" />

      <HowTo
        steps={[
          "Plan posts here — this is the no-code content calendar, separate from the live publishing scheduler on the Social page.",
          "Each post links to a Channel, Pillar, and Campaign and moves Idea → Draft → Approved → Scheduled → Published.",
          "Create, edit, and delete write straight back to the Airtable Posts table.",
          "What this page can do is governed by the Social Media base’s Front-End Access table — flip a checkbox there to enable/disable, no deploy.",
        ]}
      />

      <p className="mb-5 max-w-prose text-sm text-slate">
        Sourced live from the campaign&apos;s Airtable <span className="font-mono">Posts</span> table in the
        Social Media base.{editable ? "" : " Read-only — turn on dashboard Create/Update/Delete for Posts in Front-End Access to edit here."}
      </p>

      {!configured ? (
        <div className="card p-8 text-center text-slate">
          Airtable isn&apos;t connected yet. Set <span className="font-mono">AIRTABLE_API_KEY</span> (a token with
          access to the Social Media base) to load the content calendar.
        </div>
      ) : (
        <ContentCalendar
          posts={posts}
          options={{ channels, pillars, campaigns }}
          editable={editable}
        />
      )}
    </>
  );
}
