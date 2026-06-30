import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listActiveCaptains, suggestCaptain } from "@/lib/volunteers/captains";
import { listRegions } from "@/lib/volunteers/regions";
import { buildGeoIndex } from "@/lib/volunteers/geo";
import { joinSuggestedTeam } from "@/app/(site)/community/actions";

// "Join a team" on the community hub. Auto-matches a volunteer to the best-fit
// captain (their area first, then the least-loaded team) and lets them join in one
// click. Shows their current team once joined. Privacy: only the captain's FIRST
// NAME + area is shown — never their email. Self-scoped to the passed email.
export async function JoinTeam({ email }: { email?: string | null }) {
  const [me, captains, regions] = await Promise.all([
    getMyVolunteerProfile(email),
    listActiveCaptains(),
    listRegions(),
  ]);
  if (!me) return null; // only people with a volunteer record see this

  // Already on a team — confirm who their lead is.
  if (me.captainEmail) {
    const cap = captains.find((c) => c.email === me.captainEmail!.toLowerCase());
    return (
      <div className="mt-14 rounded-sm border border-field/40 bg-field/5 p-6">
        <p className="eyebrow text-field">Your team</p>
        <p className="mt-2 font-display text-lg font-semibold text-ink">
          You&apos;re on {cap ? `${cap.firstName}'s` : "a"} team.
        </p>
        <p className="mt-1 text-sm text-slate">
          Your captain will reach out to plug you into shifts and events. Thanks for stepping up.
        </p>
      </div>
    );
  }

  if (!captains.length) return null; // no captains to join yet
  const pick = suggestCaptain({ zip: me.zip, city: me.city }, captains, buildGeoIndex(regions));
  if (!pick) return null;

  return (
    <div className="mt-14">
      <p className="eyebrow text-brick">Your team</p>
      <h2 className="mt-2 text-2xl font-semibold">Join a volunteer team</h2>
      <p className="mt-1 max-w-prose text-sm text-slate">
        Volunteers do more together. We&apos;ll connect you with{" "}
        <span className="font-semibold text-ink">{pick.firstName}</span>
        {pick.area ? ` (${pick.area})` : ""}, a team captain who&apos;ll help you get started and staff you onto
        local action.
      </p>
      <form action={joinSuggestedTeam} className="mt-4">
        <button type="submit" className="btn-primary">Join {pick.firstName}&apos;s team →</button>
      </form>
    </div>
  );
}
